const config = require('./config');
const server = require('./server');
const express = require('express');
const app = express();
const http = require('http');

app.set('domain', config.DOMAIN);
app.set('port', process.env.PORT || config.PORT || 3000);
app.set('port-https', process.env.PORT_HTTPS || 8443);

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/u/:name', server.get_user);
app.get('/.well-known/webfinger', server.get_webfinger);
app.get('/inbox', (req, res) => res.send('Here lies the inbox'));

http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
