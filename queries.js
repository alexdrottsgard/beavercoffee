const Neode = require('neode');

const neo4j = require('neo4j-driver').v1;

const uri = 'bolt://tatum-union-yellow-muriel.graphstory.services:7687';
const user = 'axelandr';
const password = 'OBRAtRGWY1gvxKJOQz7JG';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));


function getAll(ctx) {
  const statement = 'MATCH (n) RETURN n LIMIT 1';
  const session = driver.session();

  return session.run(statement)
  .then(result => {
    console.log('Bolt result: ' + result.records[0].get(0).toString());
    session.close();
    ctx.body = result.records[0].get(0).toString();
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
      console.log(ctx);
  }).catch(error => {
    console.log('herro mr error');
    console.log(error);
  });
}

module.exports = {
  getAll, addProduct
}
