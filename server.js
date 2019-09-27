const config = require('./config');
const ssb_bridge = require('./ssb_bridge');

DOMAIN = config.DOMAIN;

let chars_to_encode = "_!*'();:@&=+$,/?#[]"; // basically anything covered by %-encoding plus underscore

function decode_webfinger_name(name) {
    name = name + "=.ed25519";
    for (let i in chars_to_encode) {
        name = name.replace("_" + chars_to_encode[i].charCodeAt(0).toString(16) + "_", chars_to_encode[i]);
    }
    return name
}

function encode_webfinger_name(name) {
    for (let i in chars_to_encode) {
        name = name.replace(chars_to_encode[i], "_" + chars_to_encode[i].charCodeAt(0).toString(16) + "_");
    }
    return name;
}

function get_webfinger(req, res) {
    let resource = req.query.resource;
    if (!resource || !resource.includes('acct:')) {
        return res.status(400).send('Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
    } else {
        let name = resource.replace('acct:', '');
        name = name.substr(0, name.indexOf('@'));
        let encoded_name = encodeURIComponent(name);

        let p = ssb_bridge.check_if_in_friends(decode_webfinger_name(name));

        p.then((result) => {
            if (result) {
                res.json(
                    {
                        'subject': `acct:${encoded_name}@${DOMAIN}`,
                        links: [
                            {
                                rel: 'self',
                                type: 'application/activity+json',
                                href: `https://${DOMAIN}/u/${encoded_name}`
                            }
                        ],
                    }
                );
            } else {
                return res.status(404).send(`No record found for ${encoded_name}.`);
            }
        }).catch((err) => {
            return res.status(500).send(`An error occured: ${err}.`);
        })
    }
}

function get_user(req, res) {
    let name = req.params.name;
    if (!name) {
        return res.status(400).send('Bad request.');
    } else {

        let p = ssb_bridge.check_if_in_friends(decode_webfinger_name(name));

        p.then((result) => {
            if (result) {

                let uname_p = ssb_bridge.get_username(decode_webfinger_name(name));
                let uname = '';

                uname_p.then((uname_res) => {
                    uname = uname_res;
                });

                if (uname === '') {
                    uname = name;
                }

                res.json(
                    {
                        '@context': [
                            'https://www.w3.org/ns/activitystreams',
                            'https://w3id.org/security/v1'
                        ],

                        id: `https://${DOMAIN}/u/${name}`,
                        type: 'Person',
                        preferredUsername: uname, //todo: read from latest about message
                        name: uname,
                        // inbox: `https://${DOMAIN}/u/${name}/inbox`,
                        inbox: `https://${DOMAIN}/inbox`,

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
            } else {
                return res.status(404).send(`No record found for ${name}.`);
            }
        }).catch((err) => {
            return res.status(500).send(`An error occured: ${err}.`);
        })
    }
}

function get_users(req, res) {
    let p = ssb_bridge.get_friends();

    p.then((result) => {
        if (result) {
            let out = {};
            for (let i in result) {
                out[i] = encode_webfinger_name(result[i].substr(1).replace("=.ed25519", ""));
            }
            res.json(out);
        } else {
            return res.status(404).send(`No record found for ${name}.`);
        }
    }).catch((err) => {
        return res.status(500).send(`An error occured: ${err}.`);
    })
}

function post_inbox(req, res) {
    console.log("Saved activity to ssb log.");
    try {
        let in_activity = JSON.parse(req.body.toString());
        ssb_bridge.save(in_activity);
    } catch (e) {

    }
    return res.status(200).send('ayy\n');
}

module.exports = {
    get_user,
    get_webfinger,
    get_users,
    post_inbox,
};