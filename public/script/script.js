




var profilebar=document.querySelector(".profile-bar");
function showprofilebar()
{
    profilebar.style.display ="block";
}
function closeprofilebar()
{
    profilebar.style.display ="none";
}

var viewprofile = document.querySelector(".view-pro");
function showviewprofilebar()
{
    viewprofile.style.display="block";
}
function closeviewprofilebar()
{
    viewprofile.style.display="none";
}



var shadow = document.querySelector(".shadow");
var viewproduct = document.querySelector(".view-product");
function showproduct1(id){
    var id =id;
    console.log("this id"+id);
    location.href="/pro";
    viewproduct.style.display="block";
    shadow.style.display="block"; 
    
} 
function closeproduct(){
    location.href="/home";
    viewproduct.style.display="none";
    shadow.style.display="none";
}


var saleproduct=document.querySelector('.sale-product');
function showsaleproduct()
{
    location.href='/addpro';
    saleproduct.style.display="block";
    shadow.style.display="block";
}

function closesaleproduct()
{
    location.href='/sellerhome';
    saleproduct.style.display="none";
    shadow.style.display="none";
}

function closeany()
{
    const closes=closeproduct();
    const closesa=closesaleproduct();
    const closeca=closeviewcart();
}


var viewcart=document.querySelector(".view-cart");
function showviewcart()
{
    viewcart.style.display="block"
    shadow.style.display="block";
}

function closeviewcart()
{
    viewcart.style.display="none";
    shadow.style.display="none";
}

function gologin()
{
    location.href='/home';
}

function logout(){
    location.href='/logout';
}


function showorders(){
    location.href='/orders';
}

function showallorders(){
    location.href='/allorders'
}

