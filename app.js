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

// Load routes with error handling
try {
  const routes = require('./server/router');
  app.use('/', routes);
  console.log('✅ Routes loaded successfully');
} catch (err) {
  console.error('❌ Error loading routes:', err);
  // Add a basic error route
  app.get('*', (req, res) => {
    res.status(500).send('Server configuration error. Please check logs.');
  });
}





// Port configuration for Catalyst deployment
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 3000;

// Error handling for server startup
const server = app.listen(port, () => {
  console.log(`✅ Server listening on port: ${port}`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit in production, log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, log and continue
});



