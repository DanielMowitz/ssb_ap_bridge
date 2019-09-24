const config = require('./config');
const server = require('./server');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');

var options = { //todo: maybe be more specific here
    type: "application/*"
};

app.use(bodyParser.raw(options));
app.use(bodyParser.urlencoded({extended: true}));

app.set('domain', config.DOMAIN);
app.set('port', process.env.PORT || config.PORT || 3000);
app.set('port-https', process.env.PORT_HTTPS || 8443);

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/u/:name', server.get_user);
app.get('/.well-known/webfinger', server.get_webfinger);
app.get('/inbox', (req, res) => res.send('Here lies the inbox'));
app.get('/users', server.get_users);

app.post('/inbox', server.post_inbox);

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
