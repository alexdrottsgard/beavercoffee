const koaLogger = require('koa-logger');
const koaBodyParser = require('koa-bodyparser');
const koaRouter = require('koa-router');
const Koa = require('koa');
const router = koaRouter();

const { getAll, addProduct, getOrdersServedByEmployee, getEmployeeListing, getStockQuantityForIngredient, getAllSales, addCommentOnEmployee, getSalesFromProducts, addOrder } = require('./queries');

const app = new Koa();

app
  .use(koaLogger())
  .use(koaBodyParser());

router

  .get('/', getAll)

  .get('/getOrdersFromEmployee/:name', getOrdersServedByEmployee)

  .get('/getEmployeeListing/:managerId/:qStartDate/:qEndDate', getEmployeeListing)

  .get('/getStockQuantityForIngredient/:managerId/:ingredientName', getStockQuantityForIngredient)

  .get('/getAllSales/:managerId/:startDate/:endDate', getAllSales)

  .post('/addComment/', addCommentOnEmployee)

  .get('/getSalesFromProducts/', getSalesFromProducts)

  .post('/addOrder', addOrder)

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
app.listen(8888);
