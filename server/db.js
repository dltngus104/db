const mariadb=require('mariadb/callback');

const conn=mariadb.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: 'root@1234',
    database: 'new_db',
    connectionLimit: 5
});

module.exports={conn};