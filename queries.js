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
    console.log('Bolt result: ' + result.records[0].get(0).toString());
    session.close();
    ctx.body = result.records[0].get(0).toString();
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
  getAll, getCustomerListing, addProduct, addEmployee
}
