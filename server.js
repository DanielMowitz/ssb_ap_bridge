const config = require('./config');
const ssbClient = require('ssb-client');
const pull = require('pull-stream');

DOMAIN = config.DOMAIN;

async function check_if_in_friends(name){
    let result = false;
    let out = new Promise((resolve, reject) => {
        ssbClient((err, sbot) => {
            if (err) reject(err);

            pull(
                sbot.friends.createFriendStream(),
                pull.collect((err, array) => {
                    array.forEach(function (actor) {
                        let short_actor = (actor.substr(1));
                        if (short_actor === name) {
                            result = true;
                        }
                    });
                    sbot.close();
                    resolve(result);
                })
            );
        });
    });
    return await out;
}

function get_webfinger(req, res) {
    let resource = req.query.resource;
    if (!resource || !resource.includes('acct:')) {
        return res.status(400).send('Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
    }
    else {
        let name = resource.replace('acct:','');
        name = name.substr(0,name.indexOf('@'));

        let p = check_if_in_friends(name + "=.ed25519");

        p.then((result) => {
            if (result) {
                res.json(
                    {
                        'subject': `acct:${name}@${DOMAIN}`,
                        links: [
                            {
                                rel: 'self',
                                type: 'application/activity+json',
                                href: `https://${DOMAIN}/u/${name}`
                            }
                        ],
                    }
                );
            } else {
                return res.status(404).send(`No record found for ${name}.`);
            }
        }).catch((err) => {
            return res.status(500).send(`An error occured: ${err}.`);
        })
    }
}

function get_user(req, res){
    let name = req.params.name;
    if (!name) {
        return res.status(400).send('Bad request.');
    }
    else {

        let p = check_if_in_friends(name + "=.ed25519");

        p.then((result) => {
            if (result) {

                res.json(
                    {
                        '@context': [
                            'https://www.w3.org/ns/activitystreams',
                            'https://w3id.org/security/v1'
                        ],

                        id: `https://${DOMAIN}/u/${name}`,
                        type: 'Person',
                        preferredUsername: 'TESTPERSON PLS CHANGE', //todo: read from latest about message
                        inbox: `https://${DOMAIN}/u/${name}/inbox`,

                        publicKey: {
                            id: `https://${DOMAIN}/u/${name}#main-key`,
                            owner: `https://${DOMAIN}/u/${name}`,
                            publicKeyPem: '-----BEGIN PUBLIC KEY-----\n' +
                                'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsT4MEtffaV0uFr9jgSnx\n' +
                                'kb1+MMd1/jGYBugJ4jkHc9rvQRJLA2C8O2LbrdNb/00TRHh0pkR7AJW7DWMhIF/P\n' +
                                'WmsHcdouAUhovAVO+4yrRK5fMA96JP6k2YwqJK+yjK4SMm9iwvcdBlrkZif0KWvA\n' +
                                'Qf4eU24n64NSEdVu48cgZwMvQeYKaAtf2LIhXYOE4pA16C05z3BAar+9m2e1yZMG\n' +
                                '+JzhoywmpqlrB+XK55wjAIhvwVGgOMtUg5FbHU5sH7wZv7H945t40x7HjNCBxU6d\n' +
                                'yrF7Bl6nMg+ifT5a6SzPSJ0f3g99AyfMVL5fnhSodjpsnjohfIsx9Vzd4oO1JhDx\n' +
                                'SwIDAQAB\n' +
                                '-----END PUBLIC KEY-----'
                        }
                    }
                );
            }else {
                return res.status(404).send(`No record found for ${name}.`);
            }
        }).catch((err) => {
            return res.status(500).send(`An error occured: ${err}.`);
        })
    }
}

module.exports = {
    get_user,
    get_webfinger
};