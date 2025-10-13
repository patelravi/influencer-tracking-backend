const axios = require('axios');

// // const data = JSON.stringify([
// //   {
// //     url: 'https://www.linkedin.com/in/bettywliu',
// //     start_date: '2018-04-25T00:00:00.000Z',
// //     end_date: '2021-05-25T00:00:00.000Z',
// //   },
// // ]);

// // axios
// //   .post(
// //     'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lyy3tktm25m4avu764&include_errors=true&type=discover_new&discover_by=profile_url',
// //     data,
// //     {
// //       headers: {
// //         Authorization: 'Bearer 6b025892aeaa6bca188e8c16b0bfdae07c07094624a4488a03aa0fdab4d10df8',
// //         'Content-Type': 'application/json',
// //       },
// //     }
// //   )
// //   .then((response) => console.log('success:', response.data))
// //   .catch((error) => console.error('error:', error));

const url =
  'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true';
const payload = '[{"url":"https://www.linkedin.com/in/ravi-gondaliya"}]';
axios
  .post(url, payload, {
    headers: {
      Authorization: `Bearer 6b025892aeaa6bca188e8c16b0bfdae07c07094624a4488a03aa0fdab4d10df8`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
  .then((response) => console.log('success:', response.data))
  .catch((error) => console.error('error:', error));

// const axios = require('axios');

// const data = JSON.stringify([
//   { url: 'https://www.linkedin.com/in/elad-moshe-05a90413/' },
//   { url: 'https://www.linkedin.com/in/jonathan-myrvik-3baa01109' },
//   { url: 'https://www.linkedin.com/in/aviv-tal-75b81/' },
//   { url: 'https://www.linkedin.com/in/bulentakar/' },
// ]);

// axios
//   .post(
//     'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true',
//     data,
//     {
//       headers: {
//         Authorization: 'Bearer 6b025892aeaa6bca188e8c16b0bfdae07c07094624a4488a03aa0fdab4d10df8',
//         'Content-Type': 'application/json',
//       },
//     }
//   )
//   .then((response) => console.log(response.data))
//   .catch((error) => console.error(error));
