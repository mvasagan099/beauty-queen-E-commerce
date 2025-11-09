const express = require('express');
const mysql= require('mysql2');
const router= express();
router.use(express.json()); // to parse JSON body
const cookieparser=require('cookie-parser');
const fs = require('fs');
const multer =require('multer');
const { title } = require('process');
const { log } = require('console');
const Razorpay = require('razorpay');
router.use(cookieparser());
const sharp = require("sharp");
const path = require("path");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();
router.use(bodyParser.urlencoded({ extended: true }));

const otpStore = new Map();

// Nodemailer setup - Gmail configuration
// Use Gmail app password (not regular password)
// To generate app password: Google Account > Security > 2-Step Verification > App passwords
let transporter = null;

// Only create transporter if credentials are available
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

if (gmailUser && gmailPass) {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass
      },
      // Add connection timeout and retry options
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify transporter connection on startup (non-blocking for deployment)
    // This runs asynchronously and won't block server startup
    setTimeout(() => {
      if (transporter) {
        transporter.verify(function (error, success) {
          if (error) {
            console.error("⚠️ Email transporter verification failed:", error.message);
            console.error("📧 Email functionality may not work. Check Gmail credentials in environment variables.");
          } else {
            console.log("✅ Email transporter is ready to send emails");
          }
        });
      }
    }, 2000); // Delay verification to allow server to start first
  } catch (err) {
    console.error("⚠️ Failed to create email transporter:", err.message);
    transporter = null;
  }
} else {
  console.warn("⚠️ Gmail credentials not found. Email functionality will be disabled.");
  console.warn("📧 Set GMAIL_USER and GMAIL_APP_PASSWORD in Catalyst environment variables.");
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
router.get("/login", (req, res) => {
  return res.render("login",{layout:false});
});

router.post("/send-otp", async (req, res) => {
  const email = req.body.email;
  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(email, { otp, expiresAt });

  const mailOptions = {
    from: `"Beauty Queen" <${process.env.GMAIL_USER || 'mvasagan099@gmail.com'}>`,
    to: email,
    subject: "Beauty Queen OTP Code",
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333; margin-bottom: 20px;">Beauty Queen OTP Verification</h2>
        <p style="font-size: 16px; color: #555;">Your OTP code is:</p>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <strong style="font-size: 32px; color: #d63384; letter-spacing: 5px;">${otp}</strong>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP will expire in 5 minutes.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px;">If you didn't request this OTP, please ignore this email.</p>
      </div>
    `
  };

  // Check if transporter is available
  if (!transporter) {
    console.error("❌ Email transporter not configured");
    return res.render("verify", { 
      email, 
      message: "Email service is not configured. Please contact support.", 
      layout: false 
    });
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent successfully to ${email}`);
    res.render("verify", { email, message: "OTP sent successfully! Please check your email." ,layout:false});
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    console.error("Error code:", err.code);
    
    // Provide more helpful error messages
    let errorMessage = "Error sending OTP. Please try again.";
    if (err.code === 'EAUTH') {
      errorMessage = "Email authentication failed. Please contact support or try again later.";
      console.error("🔐 Authentication Error - Check Gmail App Password:");
      console.error("   1. Go to: https://myaccount.google.com/apppasswords");
      console.error("   2. Generate a new App Password for 'Mail'");
      console.error("   3. Update the password in your .env file or code");
    } else if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
      errorMessage = "Connection timeout. Please check your internet connection and try again.";
    } else if (err.response) {
      errorMessage = `Email service error: ${err.response}`;
    }
    
    res.render("verify", { 
      email, 
      message: errorMessage, 
      layout: false 
    });
  }
});

router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore.get(email);

  if (!record) {
    return res.render("verify", { email, message: "No OTP found for this email." ,layout:false});
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.render("verify", { email, message: "OTP expired. Please try again." ,layout:false});
  }

  if (otp === record.otp) {
    otpStore.delete(email);
    res.cookie("email", email, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
    res.redirect('/home');
  } else {
    res.render("verify", { email, message: "Invalid OTP. Try again." ,layout:false});
  }
});







const storage =multer.diskStorage({
    destination: (req,file,cb)=>{
        cb(null,"uploads/");
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now() + "-" + file.originalname);
    },

});

const upload = multer({ storage: storage });


path.join(__dirname, "..", "public", "image");


async function processImage(file, filename) {
  if (!file) return null;

  // Absolute path to target folder
  const dir = path.join(__dirname, "..", "public", "image");

  // Create folder if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("✅ Created folder:", dir);
  }

  const outputPath = path.join(dir, `${filename}.webp`);

  try {
    await sharp(file.path)
      .resize(800)
      .toFormat("webp", { quality: 80 })
      .toFile(outputPath);

    fs.unlinkSync(file.path); // delete temp upload
    return `image/${filename}.webp`;
  } catch (err) {
    console.error("❌ Sharp processing error:", err);
    throw err;
  }
}

// Database connection - using environment variables if available, otherwise fallback to local
// For Catalyst deployment, set these in Catalyst console: DB_HOST, DB_USER, DB_PASS, DB_NAME
let conn = null;

try {
  conn = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQL_HOST,
    user: process.env.DB_USER || process.env.MYSQL_USER,
    password: process.env.DB_PASS || process.env.MYSQL_PASSWORD ,
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Valid MySQL2 pool options
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  // Test database connection (non-blocking for deployment)
  setTimeout(() => {
    if (conn) {
      conn.getConnection((err, connection) => {
        if (err) {
          console.error('⚠️ Database connection error:', err.message);
          console.error('📊 Database queries may fail. Check database credentials in Catalyst environment variables.');
        } else {
          console.log('✅ Database connection successful');
          connection.release();
        }
      });
    }
  }, 2000); // Delay to allow server to start first
} catch (err) {
  console.error('⚠️ Failed to create database connection pool:', err.message);
  console.error('📊 Database functionality will be disabled. Check database credentials.');
  conn = null;
}

const razorpay = new Razorpay({
  key_id: 'rzp_test_RYAiLF3jXWjUtv',       // Replace with your Razorpay Key ID
  key_secret: 'TQit1JBhJCwbfqBV2V6WEkuX'    // Replace with your Razorpay Secret
});
router.post("/upipayment", async (req, res) => {
  const { username, email, address, pincode, district, landmark, productid, size, quantity, total } = req.body;

  // Convert all product fields to arrays
  const productIds = Array.isArray(productid) ? productid : [productid];
  const sizes = Array.isArray(size) ? size : [size];
  const quantities = Array.isArray(quantity) ? quantity : [quantity];
  const totals = Array.isArray(total) ? total : [total];

  try {
    // Create Razorpay order
    const options = {
      amount: totals.reduce((a, b) => parseInt(a) + parseInt(b), 0) * 100, // paise
      currency: "INR",
      receipt: "order_rcptid_" + Math.floor(Math.random() * 10000)
    };
    const razorpayOrder = await razorpay.orders.create(options);

    // Render Razorpay checkout page
    res.render("razorpay", {
      layout: false,
      key_id: razorpay.key_id,
      order_id: razorpayOrder.id,
      username,
      email,
      total: totals.reduce((a, b) => parseInt(a) + parseInt(b), 0),
      productIds,
      sizes,
      quantities,
      totals,
      address,
      pincode,
      district,
      landmark
    });
  } catch (err) {
    console.log(err);
    res.send("Error creating Razorpay order: " + err.message);
  }
});


router.get('/',(req,res)=>{
    res.redirect('/home');
});


router.get('/home', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        const newArrivalQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY id DESC
            LIMIT 4
        `;

        const sareeQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
            limit 6
        `;

        const kurthiQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
            limit 6
        `;
        const topQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
            limit 6
        `;
        const legginQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
            limit 6
        `;
        const cosmeticsQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
            limit 6
        `;




        const randomQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY RAND()
            LIMIT 4
        `;

        const highPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price DESC
            LIMIT 4
        `;

        const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });


            const email=req.cookies.email;
            if(email==undefined){
              
        // Run all queries at once
        Promise.all([
            queryAsync(newArrivalQuery),
            queryAsync(sareeQuery, ['saree']),
            queryAsync(kurthiQuery, ['kurthi']),
            queryAsync(topQuery, ['top']),
            queryAsync(legginQuery, ['leggin']),
            queryAsync(cosmeticsQuery, ['cosmetics']),
            queryAsync(randomQuery),
            queryAsync(highPriceQuery),
            queryAsync(lowPriceQuery)
        ])
        .then(([newarrival, saree, kurthi,top,leggin,cosmetics, randomProducts, highPrice, lowPrice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index', {
                layout: false,
                saree,
                kurthi,
                top,
                leggin,
                cosmetics,
                newarrival,
                randomProducts,
                highPrice,
                lowPrice,
                title2:'login'
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });

            }
            else{
                    
        // Run all queries at once
        Promise.all([
            queryAsync(newArrivalQuery),
            queryAsync(sareeQuery, ['saree']),
            queryAsync(kurthiQuery, ['kurthi']),
            queryAsync(topQuery, ['top']),
            queryAsync(legginQuery, ['leggin']),
            queryAsync(cosmeticsQuery, ['cosmetics']),
            queryAsync(randomQuery),
            queryAsync(highPriceQuery),
            queryAsync(lowPriceQuery)
        ])
        .then(([newarrival, saree, kurthi,top,leggin,cosmetics, randomProducts, highPrice, lowPrice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index', {
                layout: false,
                saree,
                kurthi,
                top,
                leggin,
                cosmetics,
                newarrival,
                randomProducts,
                highPrice,
                lowPrice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
            }


    });

});


router.get('/saree-view', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        

        const sareeQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 AND ptype=?
            order by rand()
        `;
          const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;
       
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

        // Run all queries at once
        const email=req.cookies.email;
        if(email==undefined){
           Promise.all([
            
            queryAsync(sareeQuery, ['saree']),
            queryAsync(lowPriceQuery)
        ])
        .then(([saree,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: saree,
                lowprice,
                title2:'email'
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
        else{
           Promise.all([
            
            queryAsync(sareeQuery, ['saree']),
            queryAsync(lowPriceQuery)
        ])
        .then(([saree,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: saree,
                lowprice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
       
    });

});



router.get('/kurthi-view', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        

        const kurthiQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
        `;
          const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;
       
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });


            const email=req.cookies.email;
        if(email==undefined){
Promise.all([
            
            queryAsync(kurthiQuery, ['kurthi']),
            queryAsync(lowPriceQuery)
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title2:'email'
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
        else{
          Promise.all([
            
            queryAsync(kurthiQuery, ['kurthi']),
            queryAsync(lowPriceQuery)
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
        // Run all queries at once
        
    });

});



router.get('/top-view', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        

        const kurthiQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
        `;
        const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;
      

       
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            const email=req.cookies.email;
        if(email==undefined){
          Promise.all([
            
            queryAsync(kurthiQuery, ['top']),
            queryAsync(lowPriceQuery)
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title2:'email'
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });


        }
        else{
          Promise.all([
            
            queryAsync(kurthiQuery, ['top']),
            queryAsync(lowPriceQuery)
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
        // Run all queries at once
        
    });

});

router.get('/leggin-view', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        

        const kurthiQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
        `;
         const lowQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;
       
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });


            const email=req.cookies.email;
        if(email==undefined){

          
        // Run all queries at once
        Promise.all([
            
            queryAsync(kurthiQuery, ['leggin']),
            queryAsync(lowQuery)
            
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title2:'email'
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });

        }else{
          
        // Run all queries at once
        Promise.all([
            
            queryAsync(kurthiQuery, ['leggin']),
            queryAsync(lowQuery)
            
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
        }
    });

});


router.get('/cosmetics-view', (req, res) => {
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        

        const kurthiQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 and ptype=?
            order by rand()
        `;
        const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;

       
        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });


            const email=req.cookies.email;
        if(email==undefined){

           // Run all queries at once
        Promise.all([
            
            queryAsync(kurthiQuery, ['cosmetics']),
            queryAsync(lowPriceQuery)
            
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title2:"email"
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });

        }
        else{
        // Run all queries at once
        Promise.all([
            
            queryAsync(kurthiQuery, ['cosmetics']),
            queryAsync(lowPriceQuery)
            
        ])
        .then(([kurthi,lowprice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth: kurthi,
                lowprice,
                title1:email
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
      }
    });

});


router.get('/orders', (req, res) => {
  const emailid = req.cookies.email;
  if (!emailid) return res.redirect('/login');

  conn.getConnection((err, connection) => {
    if (err) return res.render('404', { layout: false });

    const sql = `
      SELECT o.*, p.image, p.name AS product_name, p.price AS product_price
      FROM orders o
      JOIN products p ON o.productid = p.id
      WHERE o.email = ?
      ORDER BY o.id DESC;
    `;

    connection.query(sql, [emailid], (err, order) => {
      connection.release();
      if (err) return res.render('404', { layout: false });

      console.log('good — rendering order page');

      res.render('order', { layout: false, order }, (renderErr, html) => {
        if (renderErr) {
          console.error('Render error:', renderErr);
          if (!res.headersSent) return res.render('404', { layout: false });
          return;
        }
        if (!res.headersSent) res.send(html);
      });
    });
  });
});





router.get('/contact',(req,res)=>{
    res.render('contact',{layout:false});
});

router.get('/sellerhome',(req,res)=>{
   
    conn.getConnection((err,connection)=>{
   if (err) throw err
    const smobile=req.cookies.smobile;
   connection.query('select * from products',(err,rows)=>{
    connection.query('select * from cust WHERE mobile=?',[smobile],(err,result1)=>{
    connection.release();
    if (!err){
        console.log('good');
        if(result1.length > 0){
            res.render('sellerhome',{ layout: false ,title:'logout', rows ,result1});
        }else{
            res.render('sellerhome',{ layout: false , title:'login',rows ,result1});
        }
        
    }else
        console.log("error in listing"+err);

   })
}) 
});

});


router.get('/singlepro/:id',(req,res)=>{
  const id = req.params.id;
  conn.getConnection((err, connection) => {
    if (err) throw err;

    connection.query('SELECT * FROM products WHERE id = ?', [id], (err, result) => {
      if (err) throw err;

      if (result.length === 0) {
        connection.release();
        return res.render('404', { layout: false });
      }

      const product = result[0];

      // ✅ Collect available sizes dynamically
      const sizes = [];
      if (product.size_s) sizes.push('Small');
      if (product.size_m) sizes.push('Medium');
      if (product.size_l) sizes.push('Large');
      if (product.size_xl) sizes.push('XL');
      if (product.size_xxl) sizes.push('XXL');

      // Get related products
      connection.query('SELECT * FROM products WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 ORDER BY RAND() LIMIT 4', (err, cloth) => {
        connection.release();
        if (err) throw err;

        res.render('singleproduct', {
          layout: false,
          result,
          cloth,
          sizes // pass available sizes to hbs
        });
      });
    });
  });
});

router.get('/cart', (req, res) => {
  const cartcookie = req.cookies.cart;
    if (!cartcookie){

  conn.getConnection((err, connection) => {
    if (err) throw err;
     connection.query('SELECT * FROM products WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 ORDER BY RAND() LIMIT 4', (err, cloth) => {
    connection.release(); 
    res.render('emptycart', { cloth:cloth,layout: false });
    });
  });
}
else{

  const cartobj = {};
  cartcookie.split(",").forEach(item => {
    const [key, qty] = item.split(":"); // key = "id-size"
    if (key) cartobj[key] = parseInt(qty);
  });

  const productKeys = Object.keys(cartobj);
  if (productKeys.length === 0) return res.render('emptycart', { layout: false });

  // Extract product IDs from keys like "12-M" → 12
  const productIds = [...new Set(productKeys.map(k => k.split("-")[0]))];

  conn.getConnection((err, connection) => {
    if (err) throw err;
     connection.query('SELECT * FROM products WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0 ORDER BY RAND() LIMIT 4', (err, cloth) => {
    connection.query("SELECT * FROM products WHERE id IN (?)", [productIds], (err, products) => {
      connection.release();
      if (err) throw err;

      // Build final cart with size and quantity
      const cartWithQty = [];

      productKeys.forEach(key => {
        const [id, size] = key.split("-");
        const qty = cartobj[key];
        const product = products.find(p => p.id == id);

        if (product) {
          cartWithQty.push({
            ...product,
            size,
            quantity: qty,
            total: product.price * qty
          });
        }
      });

      const grandtotal = cartWithQty.reduce((sum, item) => sum + item.total, 0);

      res.render('cart', {
        layout: false,
        cart: cartWithQty,
        cloth,
        grandtotal
      });
    });
  });
});

}

});








router.post('/addcart', (req, res) => {
  const oneYear = 1000 * 60 * 60 * 24 * 365;
  const productid = req.body.addcartid;
  const quantity = parseInt(req.body.quantity);
  const size = req.body.size; // selected size

  conn.getConnection((err, connection) => {
    if (err) throw err;

    // 1️⃣ Get product details
    connection.query('SELECT * FROM products WHERE id = ?', [productid], (err, result) => {
      if (err || result.length === 0) {
        connection.release();
        return res.render('404', { layout: false });
      }

      const product = result[0];

      // 2️⃣ Pick correct stock based on selected size
      let availableQty = 0;
switch (size.toLowerCase()) {
  case 'small': availableQty = parseInt(product.size_s) || 0; break;
  case 'medium': availableQty = parseInt(product.size_m) || 0; break;
  case 'large': availableQty = parseInt(product.size_l) || 0; break;
  case 'xl': availableQty = parseInt(product.size_xl) || 0; break;
  case 'xxl': availableQty = parseInt(product.size_xxl) || 0; break;
  default: availableQty = 0;
}


      // 3️⃣ Parse cookie
      let cartcookie = req.cookies.cart || "";
      let cartobj = {};
      if (cartcookie) {
        cartcookie.split(",").forEach(item => {
          const [key, qty] = item.split(":"); // key = "id-size"
          if (key) cartobj[key] = parseInt(qty);
        });
      }

      const key = `${productid}-${size}`;
      const alreadyInCart = cartobj[key] || 0;
      const totalAfterAdd = alreadyInCart + quantity;

      // 4️⃣ Check if enough stock exists for that size
      if (totalAfterAdd > availableQty) {
        connection.query('SELECT * FROM products WHERE ptype=?', ['cloth'], (err, cloth) => {
          connection.release();
          console.log('Selected size:', size);
console.log('Available qty for this size:', availableQty);

          return res.render('singleproduct', {
            layout: false,
            result,
            cloth,
            error: `No mare stack available for size ${size}. You already have ${alreadyInCart} in your cart.`,
          });
        });
      } else {
        // 5️⃣ Update cart
        cartobj[key] = totalAfterAdd;
        const newcartstring = Object.entries(cartobj)
          .map(([key, qty]) => `${key}:${qty}`)
          .join(",");

        res.cookie("cart", newcartstring, { maxAge: oneYear, httpOnly: true });
        connection.release();
        res.redirect('/cart');
      }
    });
  });
});



router.post('/buynow', (req, res) => {
  const productid = req.body.addcartid;
  const quantity = parseInt(req.body.quantity);
  const size = req.body.size;

  conn.getConnection((err, connection) => {
    if (err) throw err;

    connection.query('SELECT * FROM products WHERE id = ?', [productid], (err, result) => {
      if (err || result.length === 0) {
        connection.release();
        return res.render('404', { layout: false });
      }

      const product = result[0];

      // ✅ Check stock for selected size
      let availableQty = 0;
switch (size.toLowerCase()) {
  case 'small': availableQty = parseInt(product.size_s) || 0; break;
  case 'medium': availableQty = parseInt(product.size_m) || 0; break;
  case 'large': availableQty = parseInt(product.size_l) || 0; break;
  case 'xl': availableQty = parseInt(product.size_xl) || 0; break;
  case 'xxl': availableQty = parseInt(product.size_xxl) || 0; break;
  default: availableQty = 0;
}


      if (quantity > availableQty) {
        connection.query('SELECT * FROM products WHERE ptype=?', ['cloth'], (err, cloth) => {
          connection.release();
          return res.render('singleproduct', {
            layout: false,
            result,
            cloth,
            error: `Stack Soled out in size ${size}.`
          });
        });
      } else {
        // ✅ Enough stock → go to checkout page
        const total = product.price * quantity;
        connection.release();
        res.render('newcheck', {
          layout: false,
          order: {
            id: product.id,
            name: product.name,
            price: product.price,
            image:product.image,
            size,
            quantity,
            total
          }
        });
      }
    });
  });
});



router.post('/cartbuynow', (req, res) => {
  const cartcookie = req.cookies.cart;

  if (!cartcookie || cartcookie.trim() === "") {
    return res.render('cart', {
      layout: false,
      cart: [],
      grandtotal: 0,
      error: "Your cart is empty."
    });
  }

  const cartItems = cartcookie.split(',').map(item => {
    const [key, qty] = item.split(':'); // key = "id-size"
    const [id, size] = key.split('-');
    return { id, size, quantity: parseInt(qty) };
  });

  const ids = cartItems.map(i => i.id);

  conn.getConnection((err, connection) => {
    if (err) throw err;

    connection.query('SELECT * FROM products WHERE id IN (?)', [ids], (err, products) => {
      connection.release();
      if (err) throw err;

      const buyItems = [];
      let allAvailable = true;
      let errorMsg = '';

      cartItems.forEach(item => {
        const product = products.find(p => p.id == item.id);
        if (!product) return;

        let availableQty = 0;
        switch (item.size.toLowerCase()) {
          case 'small': availableQty = parseInt(product.size_s); break;
          case 'medium': availableQty = parseInt(product.size_m); break;
          case 'large': availableQty = parseInt(product.size_l); break;
          case 'xl': availableQty = parseInt(product.size_xl); break;
          case 'xxl': availableQty = parseInt(product.size_xxl); break;
        }

        if (item.quantity > availableQty) {
          allAvailable = false;
          errorMsg = `Only ${availableQty} items available for ${product.name} (Size: ${item.size})`;
        }

        buyItems.push({
          id: product.id,
          name: product.name,
          size: item.size,
          image:product.image,
          quantity: item.quantity,
          price: product.price,
          total: product.price * item.quantity
        });
      });

      const grandtotal = buyItems.reduce((sum, i) => sum + i.total, 0);

      if (!allAvailable) {
        return res.render('cart', {
          layout: false,
          cart: buyItems,
          grandtotal,
          error: errorMsg
        });
      }

      // Render checkout page
      res.render('ccheckout', {
        layout: false,
        orders: buyItems,
        grandtotal
      });
    });
  });
  
});


router.get('/removecart/:id/:size', (req, res) => {
  const { id, size } = req.params;
  const keyToRemove = `${id}-${size}`;

  const cartcookie = req.cookies.cart || "";
  if (!cartcookie) return res.redirect('/cart');

  // Parse cookie to object
  const cartobj = {};
  cartcookie.split(',').forEach(item => {
    const [key, qty] = item.split(":");
    if (key && qty) cartobj[key] = parseInt(qty);
  });

  // Remove the item
  if (cartobj.hasOwnProperty(keyToRemove)) {
    delete cartobj[keyToRemove];
  }

  // Rebuild cookie string
  const newCartString = Object.entries(cartobj)
    .map(([key, qty]) => `${key}:${qty}`)
    .join(",");

  if (newCartString) {
    res.cookie('cart', newCartString, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
  } else {
    res.clearCookie('cart');
  }

  res.redirect('/cart');
});




router.get("/clear-cart", (req, res) => {
  res.clearCookie("cart");
  res.redirect("/");
});
router.get("/clear-mail", (req, res) => {
  res.clearCookie("email");
  res.redirect("/");
});

router.get('/404',(req,res)=>{
    res.render('404',{ layout: false})
});


router.get('/addpro',(req,res)=>{
    res.render('addpro',{ layout: false})
});

router.post(
  "/addpro",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 },
  ]),
  async (req, res) => {
    conn.getConnection(async (err, connection) => {
      if (err) throw err;

      const {
        id,
        name,
        size_s,
        size_m,
        size_l,
        size_xl,
        size_xxl,
        mrp,
        price,
        ptype,
        quantity,
        description,
      } = req.body;

      // Ensure public/image directory exists
      const imageDir = path.join(__dirname, '..', 'public', 'image');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      // Function to process and save image
      async function processImage(file, filename) {
        if (!file) return null;
        const outputPath = path.join(imageDir, `${filename}.webp`);
        try {
          await sharp(file.path)
            .resize(800)
            .toFormat('webp', { quality: 80 })
            .toFile(outputPath);

          fs.unlinkSync(file.path); // delete temp file
          return `image/${filename}.webp`;
        } catch (err) {
          console.error("Error processing image:", err);
          return null;
        }
      }

      // Process all images
      const img = await processImage(req.files["image"]?.[0], `${id}-0`);
      const img1 = await processImage(req.files["image1"]?.[0], `${id}-1`);
      const img2 = await processImage(req.files["image2"]?.[0], `${id}-2`);
      const img3 = await processImage(req.files["image3"]?.[0], `${id}-3`);
      const img4 = await processImage(req.files["image4"]?.[0], `${id}-4`);

      const query = `
        INSERT INTO products 
        (id, name, size_s, size_m, size_l, size_xl, size_xxl, mrp, price, ptype, quantity, description, image, image1, image2, image3, image4) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      connection.query(
        query,
        [id, name, size_s, size_m, size_l, size_xl, size_xxl, mrp, price, ptype, quantity, description, img, img1, img2, img3, img4],
        (err) => {
          connection.release();
          if (!err) {
            console.log("✅ Product added successfully");
            res.render("addpro", { msg: "Your product added successfully!", layout: false });
          } else {
            console.error("❌ Error inserting:", err);
            res.render("addpro", { msg: "Error adding product", layout: false });
          }
        }
      );
    });
  }
);


router.post('/payment', (req, res) => {
  const {
    username,
    email,
    address,
    Pincode,
    district,
    landmark,
    Payment,
    upiId,
    productid,
    size,
    quantity,
    total
  } = req.body;

  conn.getConnection((err, connection) => {
    if (err) throw err;

    // Get product details (optional, to store product name/price)
    connection.query('SELECT * FROM products WHERE id=?', [productid], (err, products) => {
      if (err) {
        connection.release();
        return res.send("DB error");
      }

      const product = products[0];
      const price = product ? product.price : total / quantity; // fallback if product not found
      const subtotal = price * quantity;

      const orderData = {
        productid,
        name: product ? product.name : "",
        size,
        price,
        quantity,
        subtotal,
        username,
        email,
        address,
        pincode: Pincode,
        district,
        landmark,
        payment_method: Payment === "UPI" ? `UPI - ${upiId}` : Payment,
        status: "Pending",
      };

      res.cookie("email", email, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
      connection.query('INSERT INTO orders SET ?', orderData, (err, result) => {
        connection.release();
        if (err) return res.send("Error placing order: " + err.message);

        // Optional: Reduce stock in products table
        let column = "";
        switch (size.toLowerCase()) {
          case "small": column = "size_s"; break;
          case "medium": column = "size_m"; break;
          case "large": column = "size_l"; break;
          case "xl": column = "size_xl"; break;
          case "xxl": column = "size_xxl"; break;
        }

        if (column) {
          conn.query(
            `UPDATE products SET ${column} = ${column} - ? WHERE id=?`,
            [quantity, productid],
            (err2) => {
              if (err2) console.log("Stock update error:", err2);
            }
          );
        }

        // Clear cart cookie
        res.clearCookie('cart');

        // Redirect to order success page
        res.render('confirmation',{layout:false});
      });
    });
  });
});

router.post('/cartpayment', (req, res) => {
  const { username, email, address, pincode, district, landmark, payment, upiId, productid, size, quantity, total } = req.body;

  // Make sure all fields are arrays
  const productIds = Array.isArray(productid) ? productid : [productid];
  const sizes = Array.isArray(size) ? size : [size];
  const quantities = Array.isArray(quantity) ? quantity : [quantity];
  const totals = Array.isArray(total) ? total : [total];

  conn.getConnection((err, connection) => {
    if (err) throw err;

    // Fetch all product info from DB
    connection.query('SELECT * FROM products WHERE id IN (?)', [productIds], (err, products) => {
      if (err) {
        connection.release();
        return res.send("DB error: " + err.message);
      }

      const orderPromises = [];

      // Loop through all cart items
      for (let i = 0; i < productIds.length; i++) {
        const pid = productIds[i];
        const itemProduct = products.find(p => p.id == pid); // ✅ correct reference

        const orderData = {
          productid: pid,
          name: itemProduct ? itemProduct.name : "",   // fetch product name safely
          size: sizes[i],
          price: itemProduct ? itemProduct.price : totals[i] / quantities[i],
          quantity: quantities[i],
          subtotal: totals[i],
          username,
          email,
          address,
          pincode,
          district,
          landmark,
          payment_method: payment === "UPI" ? `UPI - ${upiId}` : "COD",
          status: "Pending"
        };
         res.cookie("email", email, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
        // Insert order
        orderPromises.push(new Promise((resolve, reject) => {
          connection.query('INSERT INTO orders SET ?', orderData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }));

        // Reduce stock
        let column = "";
        switch (sizes[i].toLowerCase()) {
          case "small": column = "size_s"; break;
          case "medium": column = "size_m"; break;
          case "large": column = "size_l"; break;
          case "xl": column = "size_xl"; break;
          case "xxl": column = "size_xxl"; break;
        }

        if (column) {
          orderPromises.push(new Promise((resolve, reject) => {
            connection.query(
              `UPDATE products SET ${column} = ${column} - ? WHERE id=?`,
              [quantities[i], pid],
              (err) => err ? reject(err) : resolve()
            );
          }));
        }
      }

      // Execute all queries
      Promise.all(orderPromises)
        .then(() => {
          connection.release();
          res.clearCookie('cart'); // clear cart after success
          res.render('confirmation',{layout:false});
        })
        .catch(err => {
          connection.release();
          console.log(err);
          res.send("Error processing order: " + err.message);
        });
    });
  });
});




router.get('/seller-login',(req,res)=>{
    res.render('seller-login',{ layout: false})
});

router.get('/seller-signup',(req,res)=>{
    res.render('seller-signup',{ layout: false})
});

router.post('/seller-signup',(req,res)=>{
    
    conn.getConnection((err,connection)=>{
    if (err) throw err
    const {sellername,mobile,email,password,repassword} =req.body;
    if(password !== repassword){
        res.render('seller-signup',{ error:"passwords does not match!" ,layout: false})
    }
    else{
    connection.query('insert into seller(sellername,mobile,email,password,repassword) values(?,?,?,?,?)',[sellername,mobile,email,password,repassword],(err,rows)=>{
    connection.release();
    if (!err){
        console.log('good');
        res.render('seller-login',{ msg:'you are signed up',layout: false})
    }
    else
        console.log("error in listing"+err);

   })
   
}});
});


router.post('/seller-login',(req,res)=>{
    
    conn.getConnection((err,connection)=>{
    if (err) throw err
    const {smobile,password} =req.body;
    res.cookie("smobile",smobile,{ maxAge:36000000000, httpOnly:true});
    connection.query('select * from seller WHERE mobile= ? and password= ?',[smobile,password],(err,result)=>{
    connection.release();
    console.log('good');
    if (!err)
        
        {
        console.log('success')
        if(result.length > 0){
        
        conn.getConnection((err,connection)=>{
   if (err) throw err

   connection.query('select * from products',(err,rows)=>{
    connection.query('select * from seller WHERE mobile=?',[smobile],(err,result1)=>{
    connection.release();
    if (!err){
        console.log('good');
        if(result1.length > 0){
            res.render('sellerhome',{ layout: false ,title:'logout', rows ,result1});
        }else{
            res.render('sellerhome',{ layout: false , title:'login',rows ,result1});
        }
        
    }else
        console.log("error in listing"+err);

   })
})
   
});
}
else{
    res.render('seller-login',{layout:false, msg: 'check mobile or password'})

}
}


})
   
});
router.get('/image/:id',(req,res)=>{
     conn.getConnection((err,connection)=>{
   if (err) throw err
    const id =req.params.id;
    connection.query('select image from products where id= ?',[id],(err,results)=>{
        connection.release();
        if (err) throw err;
        if (results.length > 0){
            res.setHeader('content-type','image/*');
            res.send(results[0].image);
        }else{
            res.status(404).send('image not found');
        }
    });
});
});  
});



// ✅ Show all orders for manager/admin
router.get('/allordersofallmanagerpro', (req, res) => {
  conn.getConnection((err, connection) => {
    if (err) {
      console.error('DB connection error:', err);
      return res.render('404', { layout: false });
    }

    const query = `
      SELECT 
        o.*, 
        p.image, 
        p.name AS product_name, 
        p.price AS product_price
      FROM orders o
      JOIN products p ON o.productid = p.id
      ORDER BY o.id DESC
    `;

    connection.query(query, (err, order) => {
      connection.release();

      if (err) {
        console.error('Query error:', err);
        return res.render('404', { layout: false });
      }

      console.log('good');
      return res.render('order', { layout: false, order });
    });
  });
});


// ✅ Separate route for serving product images (global)
router.get('/image/:id', (req, res) => {
  const id = req.params.id;

  conn.getConnection((err, connection) => {
    if (err) {
      console.error('DB connection error:', err);
      return res.render('404', { layout: false });
    }

    connection.query('SELECT image FROM products WHERE id = ?', [id], (err, results) => {
      connection.release();

      if (err) {
        console.error('Query error:', err);
        return res.render('404', { layout: false });
      }

      if (results.length > 0) {
        res.setHeader('Content-Type', 'image/*');
        return res.send(results[0].image);
      } else {
        return res.render('404', { layout: false });
      }
    });
  });
});





router.post('/search', (req, res) => {
  const sname = req.body.search;
    console.log('Search:', sname);
     conn.getConnection((err, connection) => {
        if (err) throw err;

        // Define all queries
        const newArrivalQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY id DESC
            LIMIT 4
        `;

        const clothQuery = `
             SELECT * FROM products
            WHERE name LIKE ? 
            AND (size_s + size_m + size_l + size_xl + size_xxl) > 0
        `;

        const randomQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY RAND()
            LIMIT 4
        `;

        const highPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price DESC
            LIMIT 4
        `;

        const lowPriceQuery = `
            SELECT * FROM products 
            WHERE (size_s + size_m + size_l + size_xl + size_xxl) > 0
            ORDER BY price ASC
            LIMIT 4
        `;

        // Convert to promises for parallel execution
        const queryAsync = (query, params = []) =>
            new Promise((resolve, reject) => {
                connection.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

        // Run all queries at once
        Promise.all([
            queryAsync(newArrivalQuery),
            queryAsync(clothQuery, [`%${sname}%`]),
            queryAsync(randomQuery),
            queryAsync(highPriceQuery),
            queryAsync(lowPriceQuery)
        ])
        .then(([newarrival, cloth, randomProducts, highPrice, lowPrice]) => {
            connection.release();
            console.log('All product data fetched');
            res.render('index-new', {
                layout: false,
                cloth,
                newarrival,
                randomProducts,
                highPrice,
                lowPrice
            });
        })
        .catch(err => {
            connection.release();
            console.error(err);
            res.render('404', { layout: false });
        });
    });

// ============================
// IMAGE 1 ROUTE
// ============================
router.get('/image/:id', (req, res) => {
    const id = req.params.id;
    conn.getConnection((err, connection) => {
        if (err) throw err;

        connection.query('SELECT image FROM products WHERE id = ?', [id], (err, results) => {
            connection.release();

            if (err) throw err;
            if (results.length > 0) {
                res.setHeader('Content-Type', 'image/*');
                res.send(results[0].image);
            } else {
                res.render('404', { layout: false });
            }
        });
    });
});

// ============================
// IMAGE 2 ROUTE
// ============================
router.get('/image1/:id', (req, res) => {
    const id = req.params.id;
    conn.getConnection((err, connection) => {
        if (err) throw err;

        connection.query('SELECT image1 FROM products WHERE id = ?', [id], (err, results) => {
            connection.release();

            if (err) throw err;
            if (results.length > 0) {
                res.setHeader('Content-Type', 'image/*');
                res.send(results[0].image1);
            } else {
                res.render('404', { layout: false });
            }
        });
    });
});
});






router.post('/delete',(req,res)=>{
    const id =req.body.id;
    console.log(id);
    conn.getConnection((err,connection)=>{
        if (err ) throw err;
        connection.query('delete from products where id =?',[id],(err)=>{
            if(err) return res.status(500).send('error in deleting product');
            res.render('allmanagerpro',{error:"deleted successfully!",layout:false});
        })
    })
})


router.get('/allmanagerpro',(req,res)=>{
  res.render('allmanagerpro',{layout:false})
});

router.get('/editthispros',(req,res)=>{
  res.render('editproduct',{layout:false})
});

router.post('/editthispro',(req,res)=>{
    const id = req.body.id;
     conn.getConnection((err,connection)=>{
        if (err ) throw err;
        connection.query('select * from products where id=?',[id],(err,results)=>{
          connection.release();
            if(err) return res.status(500).send('error in fetching product');
            res.render('editproduct',{product:results[0], layout:false });
        });
    });
});

router.post('/editthispross/:id',(req,res)=>{
    const id =req.params.id;
    const {name,price,description,mrp,size_s,size_m,size_l,size_xl,size_xxl} = req.body;
    conn.getConnection((err,connection)=>{
        if (err ) throw err;
        connection.query('update products set id=?,name=?,price=?,description=?,mrp=?,size_s=?,size_m=?,size_l=?,size_xl=?,size_xxl=? where id =?',[id,name,price,description,mrp,size_s,size_m,size_l,size_xl,size_xxl,id],(err)=>{
            if(err) return res.status(500).send('error in updating product');
            res.render('allmanagerpro',{layout:false,error:'updated succesfully!'});
        });
    });
});

router.post('/editorderstatus',(req,res)=>{
    const id = req.body.id;
     conn.getConnection((err,connection)=>{
        if (err ) throw err;
        connection.query('select * from orders where id=?',[id],(err,results)=>{
          connection.release();
            if(err) return res.status(500).send('error in fetching product');
            res.render('editstatus',{product:results[0], layout:false });
        });
    });
});


router.post('/editstatuspro/:id',(req,res)=>{
    const id =req.params.id;
    const status = req.body.status;
    conn.getConnection((err,connection)=>{
        if (err ) throw err;
        connection.query('update orders set status=? where id =?',[status,id],(err)=>{
            if(err) return res.status(500).send('error in updating product');
            res.render('allmanagerpro',{layout:false,error:'updated succesfully!'});
        });
    });
});



// Health check route for Catalyst deployment
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;







