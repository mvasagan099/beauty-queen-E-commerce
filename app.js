const express = require('express');
const bodyparser = require('body-parser');
const exphbs =require('express-handlebars');
const compression = require('compression');

const app = express();
app.use(bodyparser.urlencoded({extended:true}));
app.use(bodyparser.json());
app.use(compression());

app.use(express.static("public",{maxAge:'1d'}));
app.use(express.static("views",{maxAge:'1d'}));

const handlebars=exphbs.create({extname:".hbs"});
app.engine('hbs', handlebars.engine);
app.set("view engine","hbs");
app.set('views', './views');
app.use('/image', express.static('public/image'));


app.use((req,res,next)=>{
  res.locals.timestamp = Date.now();
  next();
});

const routes =require('./server/router');
app.use('/',routes);





const port=process.env.X_ZOHO_CATALYST_LISTEN_PORT  || 3306;
//const port=3000;
app.listen(port,()=>{
  console.log('listening port :'+ port);
  });



