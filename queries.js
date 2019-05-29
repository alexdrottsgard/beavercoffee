const neo4j = require('neo4j-driver').v1;

const uri = 'bolt://tatum-union-yellow-muriel.graphstory.services:7687';
const user = 'filhefor';
const password = 'ldkyQWNQBr2QTphbcHtUwBMF4ai';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));


function getAll(ctx) {
  const statement = 'MATCH (n) RETURN n';
  const session = driver.session();

  return session.run(statement)
  .then(result => {
    //console.log('Bolt result: ' + result.records[0].get(0).toString());
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
  });
}

function addProduct(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement = `CREATE (p:Product { name: '${data.product}' }) RETURN p`
  return session.run(statement)
    .then(result => {
      session.close();
      ctx.body = result.records[0].get(0).toString();
      ctx.status = 200;
  }).catch(error => {
    console.log('herro mr error');
    console.log(error);
  });
}

function getOrdersServedByEmployee(ctx) {
  const session = driver.session();
  const { name } = ctx.params;
  const statement = `MATCH (:Employee {name: '${name}'})-[:ENTERED]->(o:Order) RETURN o`

  return session.run(statement)
    .then(result => {
      let orders = [];
      result.records.forEach(element => {
        let orderId = element.get(0).identity.low; //ORDER ID
        let totalPrice = element.get(0).properties.price.low; //ORDER TOTAL PRICE
        let products = getProductsFromOrder(orderId);
        
        orders.push(
          {
            id: orderId,
            totalPrice: totalPrice,
            products: products.then(result => { return result })
          }
        );
      });
      session.close();
      ctx.body = orders;
      ctx.status = 200;
    }).catch(error => {
      console.log('herro mr error');
      console.log(error);
    });
}

function getProductsFromOrder(orderId) {
  return new Promise(function(resolve, reject) {
    let products = [];
    const session = driver.session();
    const statement = `MATCH (o:Order)-[c:CONTAINS]->(p:Product) WHERE ID(o) = ${orderId} RETURN c,p`
    session.run(statement)
      .then(result => {
        result.records.forEach(element => {
          products.push(
            {
              name: element.get("p").properties.name,
              price: element.get("p").properties.price.low,
              amount: element.get("c").properties.amount.low
            }
          )
        });
        session.close();
        resolve(products);
      });  
  });
}

function getEmployeeListing(ctx) {
  const session = driver.session();
  const { managerId, qStartDate, qEndDate } = ctx.params;
  //console.log(coffeeShop);
  const statement = `MATCH (man:Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:WORKS_AT]-(e:Employee) WHERE ID(man) = ${managerId} RETURN e`
  return session.run(statement)
    .then(result => {
      let listReturn = [];

      result.records.forEach(element => {
        
        let startDate = element.get("e").properties.startDate.year.low + 
        '-' + element.get("e").properties.startDate.month.low + '-' + 
        element.get("e").properties.startDate.day.low;

        let endDate = element.get("e").properties.endDate.year.low + 
        '-' + element.get("e").properties.endDate.month.low + '-' + 
        element.get("e").properties.endDate.day.low;

        if (startDate.localeCompare(qStartDate) != -1 && startDate.localeCompare(qEndDate) != 1) {
          listReturn.push(
            {
              name: element.get("e").properties.name,
              SSN: element.get("e").properties.SSN,
              percentage: element.get("e").properties.percentage,
              start_date: startDate,
              end_date: endDate
            }
          )
        }
      });
      session.close();
      ctx.body = listReturn;
      ctx.status = 200;
    }).catch(error => {
      console.log("herro mr error");
      console.log(error);
    });
}

function getStockQuantityForIngredient(ctx) {
  const session = driver.session();
  const { managerId, ingredientName } = ctx.params;
  const statement = `MATCH (man:Employer)-[:WORKS_AT]->(:CoffeeShop)-[:HAS]->
  (:Stock)-[r:HAS]->(i:Ingredient {name: '${ingredientName}'}) WHERE ID(man) = ${managerId} RETURN i,r.amount`
  return session.run(statement)
    .then(result => {
      console.log(result.records[0].get("r.amount"));
      session.close();
      ctx.body = {
        ingredient: result.records[0].get('i').properties.name,
        amount: result.records[0].get('r.amount').low
    }
    ctx.status = 200;
    }).catch(error => {
      console.log(error);
    });
}

function getAllSales(ctx) {
  const session = driver.session();
  const { managerId, startDate, endDate } = ctx.params;
  const statement = `MATCH (man:Employer)-[:WORKS_AT]->(c:CoffeeShop)<-[:WORKS_AT]-()
  -[:ENTERED]->(o:Order) WHERE ID(man) = ${managerId} RETURN o,c,man`
  return session.run(statement)
    .then(result => {
      let manager = result.records[0].get("man");
      let country = result.records[0].get("c").properties.country;
      let city = result.records[0].get("c").properties.cityAddress;
      let totalSales = 0.0;
      result.records.forEach(element => {
        let createdAt = element.get('o').properties.createdAt.year.low + "-" +
        element.get('o').properties.createdAt.month.low + "-" +
        element.get('o').properties.createdAt.day.low;
        if (createdAt.localeCompare(startDate != -1) && createdAt.localeCompare(endDate) != 1) {
          totalSales += element.get('o').properties.price.low == null ? element.get('o').properties.price : element.get('o').properties.price.low;
        } 
      });
      session.close();
      ctx.body = {
        location: 
        {
          country: manager.properties.position === "Corporate Sales Manager" ? "All countries" : country,
          city: manager.properties.position === "Corporate Sales Manager" ? "All cities" : city
        },
        totalSales: totalSales
      }
      ctx.status = 200;
    }).catch(error => {
      console.log(error);
    })
}

function addCommentOnEmployee(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  if (data.comment.length > 300) {
    session.close();
    ctx.status = 403;
    ctx.body = "Comment must be less than 300 characters";
    return;
  }

  const statement = `MATCH (em:Employer),(e:Employee {name: '${data.employeeName}'}) WHERE ID(em) = ${data.employerId}
  CREATE (em)-[r:COMMENTED {comment: '${data.comment}' }]->(e) RETURN r,em,e`
  return session.run(statement)
    .then(result => {
      // console.log(result.records.get("r"));
      session.close();
      ctx.body = {
        comment: result.records[0].get("r").properties.comment,
        from: result.records[0].get("em").properties.name,
        on: result.records[0].get("e").properties.name
      }
      ctx.status = 200;
    }).catch(error => {
      console.log(error);
    });
}

function getSalesFromProducts(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement = `MATCH (man:Employer)-[:WORKS_AT]->(c:CoffeeShop)<-[:WORKS_AT]-()
  -[:ENTERED]->(o:Order)-[r:CONTAINS]->(p:Product) WHERE ID(man) = ${data.managerId} RETURN man,o,c,r,p`
  
  return session.run(statement)
    .then(result => {
      let manager = result.records[0].get("man");
      let coffeeShop = result.records[0].get("c");
      let totalSales = 0.0;
      result.records.forEach(element => {
        //console.log(element.get("o").identity.low);
        let orderCreated = element.get("o").properties.createdAt.year.low + 
        "-" + element.get("o").properties.createdAt.month.low + "-" +
        element.get("o").properties.createdAt.day.low;
        //console.log(orderCreated);
        let product = element.get("p");
        let amount = element.get("r").properties.amount.low;
        console.log(product.properties.price.low);
        if (data.products.includes(product.properties.name)) {
          //console.log("true");
          if (orderCreated.localeCompare(data.qStartDate) != -1 && orderCreated.localeCompare(data.qEndDate) != 1) {
            //console.log("ORDER IN RANGE");
            
            totalSales += amount * (product.properties.price.low == null ? product.properties.price : product.properties.price.low);
          }    
        }else {
          console.log("WRONG NAME");
        }
      });
      session.close();
      ctx.body = {
        location: 
        {
          country: manager.properties.position === "Corporate Sales Manager" ? "All countries" : coffeeShop.properties.country,
          city: manager.properties.position === "Corporate Sales Manager" ? "All cities" : coffeeShop.properties.cityAddress
        },
        products: data.products,
        totalSales: totalSales
      }
      ctx.status = 200;
    }).catch(error => {
      console.log(error);
    });
}

function addOrder(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const statement = `MATCH (e:Employee {name: '${data.employeeName}'})-[:WORKS_AT]->(:CoffeeShop)-[:HAS]->(s:Stock),(cust {name: '${data.customerName}'}) 
  CREATE (e)-[:ENTERED]->(o:Order {createdAt: datetime(), price: 0.0})<-[:PLACED]-(cust) RETURN o,s,cust`
  session.run(statement)
    .then(result => {
      let discount = 1.0;
      if (result.records[0].get("cust").labels[0] === "Employee") {
        discount = 0.9;
      }
      let stockId = result.records[0].get("s").identity.low; 
      let orderId = result.records[0].get("o").identity.low;
      data.products.forEach(product => {
        const pStatement = `MATCH (o:Order) WHERE ID(o) = ${orderId} SET o.price = o.price + ${product.price} * ${product.amount} * ${discount} 
        CREATE (p:Product {name: '${product.productName}', price: ${product.price}})<-[r:CONTAINS {amount: ${product.amount}}]-(o) RETURN o`;
        session.run(pStatement)
          .then(pResult => {
            product.ingredients.forEach(ingredient => {
              const iStatement = `MATCH (s:Stock)-[r:HAS]->(i:Ingredient {name: '${ingredient}'}) WHERE ID(s) = ${stockId} SET r.amount = r.amount - ${product.amount} RETURN r`;
              session.run(iStatement)
                .then(iResult => {
                  console.log("YAY");
                });
            });
          });
      });
    });
}

module.exports = {
  getAll, addProduct, getOrdersServedByEmployee, getEmployeeListing, getStockQuantityForIngredient, getAllSales, addCommentOnEmployee, getSalesFromProducts, addOrder
}
