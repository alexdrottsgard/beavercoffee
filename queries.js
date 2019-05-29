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

async function getOrdersServedByEmployee(ctx) {
  const session = driver.session();
  const { name } = ctx.params;
  const statement = `MATCH (:Employee {name: '${name}'})-[:ENTERED]->(o:Order) RETURN o`
  const result = await session.run(statement);
  session.close();

  const orders = [];
  for (const element of result.records) {
    const orderId = element.get(0).identity.low; //ORDER ID
    const totalPrice = element.get(0).properties.price.low; //ORDER TOTAL PRICE
    const product = await getProductsFromOrder(orderId);
    orders.push({
      id: orderId,
      totalPrice: totalPrice,
      products: product
    });
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

function getEmployeeListing(ctx) {

}

module.exports = {
  getAll, addProduct, getOrdersServedByEmployee, getEmployeeListing
}
