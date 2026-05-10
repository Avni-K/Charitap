const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'himanshu@charitap.com',
      password: 'charitap'
    });
    console.log("Login Success:", res.data);
  } catch (err) {
    console.error("Login Failed:", err.response ? err.response.data : err.message);
  }
}
test();
