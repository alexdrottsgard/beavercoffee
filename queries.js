const neo4j = require('neo4j-driver').v1;

const uri = process.env.uri;
const user = process.env.username;
const password = process.env.password;

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));


function getAll(ctx) {
  const statement = 'MATCH (n) RETURN n LIMIT 25';
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

function getCustomerListing(ctx) {
  const session = driver.session();
  const { managerId, qStartDate, qEndDate } = ctx.params;
  const statement = `MATCH (c:Customer)-[:MEMBER_OF]->(:CoffeeShop)<-[:WORKS_AT]-(man:Employer) WHERE ID(man) = ${managerId} RETURN c`
  return session.run(statement)
    .then(result => {
      let returnList = [];
      result.records.forEach(element => {
          let joinDate = element.get('c').properties.joinDate.year.low + '-' +
          element.get('c').properties.joinDate.month.low + '-' +
          element.get('c').properties.joinDate.day.low;
          if (joinDate.localeCompare(qStartDate) != -1 && joinDate.localeCompare(qEndDate) != 1) {
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
    }).catch(error => {
      console.log(error);
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

async function getOrdersServedByEmployee(ctx) {
  const session = driver.session();
  const { name, managerId, qStartDate, qEndDate } = ctx.params;
  const statement = `MATCH (man: Employer)-[:WORKS_AT]->(:CoffeeShop)<-[:WORKS_AT]-(:Employee {name: '${name}'})-[:ENTERED]->(o:Order) WHERE ID(man)=${Number(managerId)} RETURN o`;
  const result = await session.run(statement);
  session.close();

  const orders = [];
  for (const element of result.records) {
    const orderId = element.get(0).identity.low; //ORDER ID
    const totalPrice = element.get(0).properties.price.low; //ORDER TOTAL PRICE
    const product = await getProductsFromOrder(orderId);

    const orderProperties = element.get('o').properties;
    const orderCreated = `${orderProperties.createdAt.year.low}-${orderProperties.createdAt.month.low}-${orderProperties.createdAt.day.low}`;

    if (orderCreated.localeCompare(qStartDate) != -1 && orderCreated.localeCompare(qEndDate) != 1) {
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

function addEmployee(ctx) {
  const session = driver.session();
  const data = ctx.request.body;
  const endDate =
    `year: ${data.endDate.year},
    month: ${data.endDate.month},
    day: ${data.endDate.day}`;

  const statement = `CREATE (e:Employee { name: '${data.name}', SSN: '${data.SSN}', startDate: dateTime(), endDate: dateTime({${endDate}}), percentage: ${data.percentage}}) RETURN e`
  return session.run(statement)
    .then(result => {
      session.close();
      ctx.body = result.records[0].get(0).toString();
      ctx.status = 200;
    }).catch(error => {
      console.log(error);
    });
}

module.exports = {
  getAll, getCustomerListing, getOrdersServedByEmployee, addProduct, addEmployee
}
