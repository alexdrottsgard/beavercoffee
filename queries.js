const neo4j = require('neo4j-driver').v1;

const uri = process.env.uri;
const user = process.env.username;
const password = process.env.password;

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));


async function getAll(ctx) {
  const statement = 'MATCH (n) RETURN n LIMIT 25';
  const session = driver.session();
  const result = await session.run(statement);

  let listReturn = [];
  result.records.forEach(element => {
    listReturn.push(
      {
        node: {
          label: element.get(0).labels[0],
          properties: element.get(0).properties
        }
      });
  });
  session.close();
  ctx.body = listReturn;
  ctx.status = 200;
}

async function getCustomerListing(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, startDate, endDate } = query;
  const statement =
    `MATCH (c:Customer)-[:MEMBER_OF]->(:CoffeeShop)<-[:WORKS_AT]-(man:Employer)
    WHERE ID(man) = ${managerId} RETURN c`;
  const result = await session.run(statement);

  let returnList = [];
  result.records.forEach(element => {
    let joinDate = element.get('c').properties.joinDate.year.low + '-' +
    element.get('c').properties.joinDate.month.low + '-' +
    element.get('c').properties.joinDate.day.low;
    if (joinDate.localeCompare(startDate) != -1 && joinDate.localeCompare(endDate) != 1) {
      returnList.push(
        {
          name: element.get('c').properties.name,
          SSN: element.get('c').properties.SSN,
          nbrOfOrders: element.get('c').properties.nbrOfOrders == null ? null : element.get('c').properties.nbrOfOrders.low,
          occupation: element.get('c').properties.occupation
        }
      )
    }
  });
  session.close();
  ctx.body = returnList;
  ctx.status = 200;

}

async function addProduct(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement = `CREATE (p:Product { name: '${data.product}' }) RETURN p`;
  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get(0).toString();
  ctx.status = 200;
}

/**
 * Get all orders served by an employee for a specified time period.
 * Query parameters are:
 * EmployerID (the location manager or corporate sales manager that requests the info)
 * EmployeeName (the employee which orders to get)
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function getOrdersServedByEmployee(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { employeeName, managerId, startDate, endDate } = query;
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:WORKS_AT]-
    (:Employee {name: '${employeeName}'})-[:ENTERED]->(o:Order) WHERE ID(man)=${managerId} RETURN o`;
  const result = await session.run(statement);
  session.close();

  const orders = [];
  for (const element of result.records) {
    const orderId = element.get(0).identity.low; //ORDER ID
    const totalPrice = element.get(0).properties.price.low; //ORDER TOTAL PRICE
    const product = await getProductsFromOrder(orderId);

    const orderProperties = element.get('o').properties;
    const orderCreated = `${orderProperties.createdAt.year.low}-${orderProperties.createdAt.month.low}-${orderProperties.createdAt.day.low}`;

    if (orderCreated.localeCompare(startDate) != -1 && orderCreated.localeCompare(endDate) != 1) {
      orders.push({
        id: orderId,
        totalPrice: totalPrice,
        products: product
      });
    }
  }

  ctx.body = orders;
  ctx.status = 200;
}

async function getProductsFromOrder(orderId) {
  const session = driver.session();
  const statement = `MATCH (o:Order)-[c:CONTAINS]->(p:Product) WHERE ID(o) = ${orderId} RETURN c,p`
  const result = await session.run(statement);
  session.close();

  const products = [];
  result.records.forEach(element => {
    products.push(
      {
        name: element.get("p").properties.name,
        price: element.get("p").properties.price.low,
        amount: element.get("c").properties.amount.low
      }
    );
  });

  return products;
}

/**
 * Get a list of employees for a specified time period
 * Query parameters are:
 * managerId (so you only get employees that works at the same location as him)
 * qStartDate and qEndDate (to only get employees that worked sometime during this time period)
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function getEmployeeListing(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, startDate, endDate } = query;
  const statement = `
    MATCH (man:Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:WORKS_AT]-(e:Employee)
    WHERE ID(man) = ${managerId} RETURN e`;
  const result = await session.run(statement);

  let listReturn = [];

      //For all employees returned
  result.records.forEach(element => {
    // (Fullösning) convert datetime object to string so we can compare employees startDate with the query dates
    let employeeStartDate = element.get("e").properties.startDate.year.low +
    '-' + element.get("e").properties.startDate.month.low + '-' +
    element.get("e").properties.startDate.day.low;

    let employeeEndDate = element.get("e").properties.endDate.year.low +
    '-' + element.get("e").properties.endDate.month.low + '-' +
    element.get("e").properties.endDate.day.low;

    // If employees startDate is between the query dates, create and add employee object in return list
    if (employeeStartDate.localeCompare(startDate) != -1 && employeeEndDate.localeCompare(endDate) != 1) {
      listReturn.push(
        {
          name: element.get("e").properties.name,
          SSN: element.get("e").properties.SSN,
          percentage: element.get("e").properties.percentage,
          start_date: employeeStartDate,
          end_date: employeeEndDate
        }
      )
    }
  });
  session.close();
  ctx.body = listReturn;
  ctx.status = 200;
}

/**
 * Get stock quantity for ingredient
 * query parameters are:
 * managerId (only look at ingredients in his locations stock)
 * ingredientName
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function getStockQuantityForIngredient(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, ingredientName } = query;
  const statement =
    `MATCH (man:Employer)-[:WORKS_AT]->(:CoffeeShop)-[:HAS]->
    (:Stock)-[r:HAS]->(i:Ingredient {name: '${ingredientName}'})
    WHERE ID(man) = ${managerId} RETURN i,r.amount`;

  const result = await session.run(statement);

  session.close();
  ctx.body = {
    ingredient: result.records[0].get('i').properties.name,
    amount: result.records[0].get('r.amount').low
  };
  ctx.status = 200;
}

/**
 * Get all sales for a specified time period.
 * Query parameters are:
 * managerId (only get sales from his locations)
 * startDate and endDate (only get sales that was created between these dates)
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function getAllSales(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, startDate, endDate } = query;
  const statement =
    `MATCH (man:Employer)-[:WORKS_AT]->(c:CoffeeShop)<-[:WORKS_AT]-()
    -[:ENTERED]->(o:Order) WHERE ID(man) = ${managerId} RETURN o,c,man`;
  const result = await session.run(statement);
  session.close();

  let manager = result.records[0].get("man");
  let country = result.records[0].get("c").properties.country; // CoffeeShops country
  let city = result.records[0].get("c").properties.cityAddress; // CoffeeShops city
  let totalSales = 0.0;
  // For each returned order
  result.records.forEach(element => {
    // (Fullösning) convert orders createdAt to string so we can compare it to inputs startDate/endDate
    let createdAt = element.get('o').properties.createdAt.year.low + "-" +
    element.get('o').properties.createdAt.month.low + "-" +
    element.get('o').properties.createdAt.day.low;
    // If the order was created sometime between inputs startDate/endDate, add orders price to totalSales variable
    if (createdAt.localeCompare(startDate != -1) && createdAt.localeCompare(endDate) != 1) {
      totalSales += element.get('o').properties.price.low == null ? element.get('o').properties.price : element.get('o').properties.price.low;
    }
  });
  ctx.body = {
    location:
    {
      country: manager.properties.position === "Corporate Sales Manager" ? "All countries" : country,
      city: manager.properties.position === "Corporate Sales Manager" ? "All cities" : city
    },
    totalSales: totalSales
  };
  ctx.status = 200;
}

/**
 * Add/post comment on employee.
 * Body in post request contains:
 * employerId (the employer that makes the comment)
 * employeeName (the employee he comments on)
 * comment (the comment)
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function addCommentOnEmployee(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  // If comment is over 300 characters return error message
  if (data.comment.length > 300) {
    session.close();
    ctx.status = 403;
    ctx.body = {
      errorMessage: "Comment must be less than 300 characters"
    }
    return;
  }

  const statement =
    `MATCH (em:Employer),(e:Employee {name: '${data.employeeName}'})
    WHERE ID(em) = ${data.employerId}
    CREATE (em)-[r:COMMENTED {comment: '${data.comment}' }]->(e) RETURN r,em,e`;

  const result = await session.run(statement);
  session.close();
  ctx.body = {
    comment: result.records[0].get("r").properties.comment,
    from: result.records[0].get("em").properties.name,
    on: result.records[0].get("e").properties.name
  }
  ctx.status = 200;
}

/**
 * (This is a get with a request body, not standard but don't know how to add a list of products of undefined size as query parameters)
 * Get all sales from one or more products for a specified time period.
 * Request body contains:
 * managerId (get only sales from his location)
 * products (a list of product names)
 * qStartDate and qEndDate (the specified time period)
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function getSalesFromProducts(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement =
    `MATCH (man:Employer)-[:WORKS_AT]->(c:CoffeeShop)<-[:WORKS_AT]-()
    -[:ENTERED]->(o:Order)-[r:CONTAINS]->(p:Product)
    WHERE ID(man) = ${data.managerId} RETURN man,o,c,r,p`;
  const result = await session.run(statement);
  session.close();

  let manager = result.records[0].get("man");
  let coffeeShop = result.records[0].get("c");
  let totalSales = 0.0;
  // for each record from the cypher query
  result.records.forEach(element => {
    // convert orders createdAt object to string
    let orderCreated = element.get("o").properties.createdAt.year.low +
    "-" + element.get("o").properties.createdAt.month.low + "-" +
    element.get("o").properties.createdAt.day.low;

    let product = element.get("p");
    let amount = element.get("r").properties.amount.low;
    // If product contains in inputs list of products and if order was created between specified time period,
    // add products price * products amount to totalSales variable
    if (data.products.includes(product.properties.name)) {
      if (orderCreated.localeCompare(data.qStartDate) != -1 && orderCreated.localeCompare(data.qEndDate) != 1) {
        totalSales += amount * (product.properties.price.low == null ? product.properties.price : product.properties.price.low);
      }
    }
  });

  ctx.body = {
    location:
    {
      country: manager.properties.position === "Corporate Sales Manager" ? "All countries" : coffeeShop.properties.country,
      city: manager.properties.position === "Corporate Sales Manager" ? "All cities" : coffeeShop.properties.cityAddress
    },
    products: data.products,
    totalSales: totalSales
  };
  ctx.status = 200;
}

/**
 * Add order.
 * Request body contains:
 * employeeName (the employee that entered the order)
 * customerName (the customer that placed the order. this could also be an employee)
 * a list of products that the customer ordered.
 * each product contains:
 * productName
 * price (price for this product)
 * amount (how many of this product the customer ordered)
 * list of ingredients for this product
 * @param {Koa.Context} ctx - contains the entire request and response context
 */
async function addOrder(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  // Match employee, customer and coffeeshop's stock and create order with relationshops to employee (entered) and customer (placed)
  const statement =
    `MATCH (e:Employee {name: '${data.employeeName}'})-[:WORKS_AT]->(:CoffeeShop)-[:HAS]->(s:Stock),
    (cust {name: '${data.customerName}'})
    CREATE (e)-[:ENTERED]->(o:Order {createdAt: datetime(), price: 0.0})<-[:PLACED]-(cust) RETURN o,s,cust`;
  const result = await session.run(statement);
  // If customer was an employee, he should have 10% discount on totalprice
  let discount = 1.0;
  if (result.records[0].get("cust").labels[0] === "Employee") {
    discount = 0.9;
  }
  let stockId = result.records[0].get("s").identity.low;
  let orderId = result.records[0].get("o").identity.low;
  let customerId = result.records[0].get("cust").identity.low;
  // For each product object in request body
  console.log('dATA PROUDCTS', data.products);
  for (const product of data.products) {
    // match order and customer that was created above, update order's price with product's price * amount.
    // Also update customers nbrOfOrders with product's amount.
    // Then create product node and relationship to order.
    console.log('PRODUCTTTTTTTTTTTT', product);
    const pStatement =
      `MATCH (o:Order),(customer) WHERE ID(o) = ${orderId} AND ID(customer) = ${customerId}
      SET o.price = o.price + ${product.price} * ${product.amount} * ${discount}
      SET customer.nbrOfOrders = customer.nbrOfOrders + ${product.amount}
      CREATE (p:Product {name: '${product.productName}', price: ${product.price}})<-[r:CONTAINS {amount: ${product.amount}}]-(o) RETURN o`;
    await session.run(pStatement);
    // For each ingredient in product
    for (const ingredient of product.ingredients) {
      const iStatement =
        `MATCH (s:Stock)-[r:HAS]->(i:Ingredient {name: '${ingredient}'})
        WHERE ID(s) = ${stockId} SET r.amount = r.amount - ${product.amount} RETURN r`;
      await session.run(iStatement);
    }
    product.ingredients.forEach(ingredient => {
      // Update stock's relationship to ingredient (decrease amount on HAS-relation)
      const iStatement = `MATCH (s:Stock)-[r:HAS]->(i:Ingredient {name: '${ingredient}'}) WHERE ID(s) = ${stockId} SET r.amount = r.amount - ${product.amount} RETURN r`;
      session.run(iStatement)
        .then(iResult => {
          // Log something here if u want to see if came to last step
        });
    });
  }
  session.close();
  ctx.body = {
    message: 'Success',
  };
  ctx.status = 200;
}

async function addCustomer(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement =
    `MATCH (em {name: '${data.employeeName}'})-[:WORKS_AT]->(cs:CoffeeShop)
    CREATE (c:Customer {joinDate: datetime(), name: '${data.name}', SSN: ${data.SSN}, zipCode: '${data.zipCode}', occupation: '${data.occupation}', nbrOfOrders: 0})
    -[:MEMBER_OF]->(cs) RETURN c`;
  const result = await session.run(statement);

  session.close();
  ctx.body = result.records[0].get("c").toString();
  ctx.status = 200;
}

async function addIngredientToStock(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)-[:HAS]->(s:Stock)
    WHERE ID(man) = ${data.managerId}
    CREATE (s)-[r:HAS {amount: ${data.amount}}]->(i:Ingredient {name: '${data.ingredientName}'})
    RETURN r.amount, i.name`;
  const result = await session.run(statement);

  session.close();
  ctx.body = {
    ingredient: result.records[0].get("i.name"),
    amount: result.records[0].get("r.amount").low
  }
  ctx.status = 200;
}

async function updateEmployeeData(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  if (data.property != "percentage") {
    data.newValue = `'${data.newValue}'`;
  }
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:WORKS_AT]-(e:Employee {name : '${data.employeeName}'})
    WHERE ID(man) = ${data.managerId}
    SET e.${data.property} = ${data.newValue} RETURN e`;
  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get("e").toString();
  ctx.status = 200;
}

async function updateCustomerData(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  if (data.property != "nbrOfOrders") {
    data.newValue = `'${data.newValue}'`;
  }
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:MEMBER_OF]-(c:Customer {name : '${data.customerName}'})
    WHERE ID(man) = ${data.managerId}
    SET c.${data.property} = ${data.newValue} RETURN c`;
  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get("c").toString();
  ctx.status = 200;
}

async function updateStockQuantityForIngredient(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)
    -[:HAS]->(s:Stock)-[r:HAS]->(i:Ingredient {name: '${data.ingredientName}'})
    WHERE ID(man) = ${data.managerId} SET r.amount = r.amount + ${data.amount} RETURN r.amount,i.name`;
  const result = await session.run(statement);
  session.close();
  ctx.body = {
    ingredient: result.records[0].get("i.name"),
    amount: result.records[0].get("r.amount").low
  };
  ctx.status = 200;
}

async function addEmployee(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const endDate =
    `year: ${data.endDate.year},
    month: ${data.endDate.month},
    day: ${data.endDate.day}`;

  const statement = `MATCH (man:Employer)-[:WORKS_AT]->(c:CoffeeShop) WHERE ID(man) = ${data.managerId}
  CREATE (e:Employee { name: '${data.name}', SSN: '${data.SSN}', startDate: dateTime(),
  endDate: dateTime({${endDate}}), percentage: ${data.percentage}})-[:WORKS_AT]->(c) RETURN e`;

  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get(0).toString();
  ctx.status = 200;
}

async function getEmployee(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, employeeName } = query;
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)
    <-[:WORKS_AT]-(e:Employee {name: '${employeeName}'}) WHERE ID(man) = ${managerId} RETURN e`;
  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get("e").toString();
  ctx.status = 200;
}

async function getCustomer(ctx) {
  const session = driver.session();
  const { query } = ctx.request;
  const { managerId, customerName } = query;
  const statement =
    `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)
    <-[:MEMBER_OF]-(c:Customer {name: '${customerName}'}) WHERE ID(man) = ${managerId} RETURN c`;
  const result = await session.run(statement);
  session.close();
  ctx.body = result.records[0].get("c").toString();
  ctx.status = 200;
}

module.exports = {
  getAll,
  addProduct,
  addEmployee,
  getOrdersServedByEmployee,
  getEmployeeListing,
  getStockQuantityForIngredient,
  getAllSales,
  addCommentOnEmployee,
  getSalesFromProducts,
  addOrder,
  addCustomer,
  addIngredientToStock,
  updateEmployeeData,
  updateCustomerData,
  updateStockQuantityForIngredient,
  getCustomerListing,
  getEmployee,
  getCustomer
}
