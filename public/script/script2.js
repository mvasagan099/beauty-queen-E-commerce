
function showproduct(id)
{
     const price = id// Get value from your function

    fetch('/pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: price })
    })
    .then(res => res.text())
    .then(data => {
      console.log("Server says:", data);
    });
}


