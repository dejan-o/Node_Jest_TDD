const app = require('./src/app');
const sequelize = require('./src/config/database');

sequelize.sync();

app.listen(3001, () => console.log('listening on port 3001...'));
