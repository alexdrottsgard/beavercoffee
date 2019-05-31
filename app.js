require('dotenv').config()
const koaLogger = require('koa-logger');
const koaBodyParser = require('koa-bodyparser');
const koaRouter = require('koa-router');
const Koa = require('koa');
const router = koaRouter();

const { getAll, addProduct, addEmployee, getOrdersServedByEmployee,
  getEmployeeListing, getCustomerListing, getStockQuantityForIngredient,
  getAllSales, addCommentOnEmployee, getSalesFromProducts,
  addOrder, addCustomer, addIngredientToStock, updateEmployeeData,
  updateCustomerData, updateStockQuantityForIngredient, getEmployee,
  getCustomer
} = require('./queries');

const app = new Koa();

app
  .use(koaLogger())
  .use(koaBodyParser());

router

  .get('/', getAll)

  .get('/getOrdersFromEmployee', getOrdersServedByEmployee)

  .get('/getEmployeeListing', getEmployeeListing)

  .get('/getStockQuantityForIngredient', getStockQuantityForIngredient)

  .get('/getAllSales', getAllSales)

  .get('/getEmployee', getEmployee)

  .get('/getCustomer', getCustomer)

  .get('/getCustomerListing', getCustomerListing)

  .get('/getSalesFromProducts/', getSalesFromProducts)

  .post('/addComment/', addCommentOnEmployee)

  .post('/addOrder', addOrder)

  .post('/addCustomer/', addCustomer)

  .post('/addIngredientToStock/', addIngredientToStock)

  .post('/updateEmployeeData/', updateEmployeeData)

  .post('/updateCustomerData/', updateCustomerData)

  .post('/updateStockQuantityForIngredient', updateStockQuantityForIngredient)

  .post('/addEmployee/', addEmployee)

  .post('/addProduct/', addProduct);

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      ctx.status = err.code || 500;
      ctx.type = err.type || 'auto';
      ctx.body = err.message;
  }
});
app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 8080);
console.info('App running');
