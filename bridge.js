const ssbClient = require('ssb-client');
const pull = require('pull-stream');

const allowed_message_types = [ //valid activitypub message types
    'create',
	'update',
	'delete',
	'follow',
	'update',
	'reject',
	'add',
	'remove',
	'like',
	'announce',
	'undo'
];

async function createBlobObject(type, objectId, otherData) {

    /*
     * Turns an activitypub object into a json object with it's id, type and a link
     * to the blob store with the rest of the data. This is done to enable deletion
     * and updating of objects.
     */

    let out = new Promise((resolve, reject) => {
        ssbClient((err, sbot) => {
            if (err) throw err;
            pull(
                pull.values(JSON.stringify(otherData)),
                sbot.blobs.add((err, blobId) => {
                    sbot.close();
                    if (err) reject(err);
                    else {
                        resolve({
                            type: type,
                            id: objectId,
                            otherData: blobId
                        });
                    }
                })
            );
        });
    });

    return await out;
}

async function get_last_by_object_id(id) {

    /*
     * Returns the last Object with the wanted id in the ssb log.
     */

    let last = null;

    let out = new Promise((resolve, reject) => {
        ssbClient((err, sbot) => {
            pull(
                sbot.createLogStream(),
                pull.collect(function (err, array) {
                    sbot.close();
                    if (err) reject(err);
                    for (let i in array) {
                        if (array[i].value.content.type === 'ap-create' ||
                            array[i].value.content.type === 'ap-update') {
                            if (array[i].value.content.object.id === id) {
                                last = array[i];
                            }
                        }
                    }
                    if (last) {
                        resolve(last);
                    } else {
                        reject('no object found.');
                    }
                }),
            );
        });
    });

    return await out;
}

async function get_last_by_activity_id(id) {

    /*
     * Returns the last Activity with the wanted id in the ssb log.
     */

    let last = null;
    
    let out = new Promise((resolve, reject) => {
        ssbClient((err, sbot) => {
            pull(
                sbot.createLogStream(),
                pull.collect(function (err, array) {
                    sbot.close();
                    if (err) reject(err);
                    for (let i in array) {
                        if (array[i].value.content.type.length > 3 &&
                            array[i].value.content.type.substr(0,3) === 'ap-' &&
                            allowed_message_types.indexOf(array[i].value.content.type.substr(3)) >= 0) {
                            if (array[i].value.content.id === id) {
                                last = array[i];
                            }
                        }
                    }
                    if (last){
                        resolve(last);
                    }else {
                        reject('no activity found');
                    }

                }),
            );
        });
    });

    return await out;
}

function delete_last_by_object_id(id) {

    /*
     * Deletes the last Object with the wanted id in the ssb log.
     */

    let p = get_last_by_object_id(id);

    p.then((data) => {
        ssbClient((err, sbot) => {
            sbot.blobs.rm(data.value.content.object.otherData);
        });
    })
}

function add_ssb_message(type, id, actor, summary, object, origin = null, target = null) {

    /*
     * Takes:
     *      type: string,
     *      id: string,
     *      actor: json object,
     *      summary: string,
     *      object: json object,
     *      origin: json object,
     *      target: json object
     *
     * Turns the json object into the appropriate blob-objects,
     * acts out any side-effects (for update and delete) and
     * adds the message to the ssb log.
     */

    let actor_type = actor.type;
    delete actor.type;
    let actor_id = actor.id;
    delete actor.id;
    let actor_promise = createBlobObject(actor_type, actor_id, actor);
    
    let object_type = object.type;
    delete object.type;
    let object_id = object.id;
    delete object.id;
    let object_promise = createBlobObject(object_type, object_id, object);
    
    Promise.all([actor_promise, object_promise]).then(([actor_blob, object_blob]) => {
        ssbClient((err, sbot) => {
            if (err) throw err;

            let msg = {
                type: 'ap-' + type,
                id: id,
                notes: summary,
                actor: actor_blob,
            };

            if (type === 'delete') {
                delete_last_by_object_id(object_id);
            } else if (type === 'update') {
                delete_last_by_object_id(object_id);
                msg.object = object_blob;
            } else {
                msg.object = object_blob;
            }

            if (origin) {
                msg.origin = origin;
            }

            if (target) {
                msg.target = target;
            }

            sbot.publish(msg);
            sbot.close();
        });
    })
    
}

async function get_json_from_blob(blob_id){

    /*
     * Gets the Object with the specified id from the
     * blob-store and returns it as a restored json object.
     */

    let out = new Promise((resolve, reject) => {
        ssbClient((err, sbot) => {
            pull(
                sbot.blobs.get(blob_id),
                pull.collect((err, array) => {
                    try {
                        resolve(JSON.parse(decodeURIComponent(escape(array))));
                    } catch (e) {
                        reject(e);
                    }
                })
            );
            sbot.close();
        })
    });

    return await out;
}

async function restore_ssb_message(id){

    /*
     * Gets the Message with the specified id from the
     * ssb log, restores all contained objects and returns
     * it as a json object.
     */

    let activity_promise = get_last_by_activity_id(id);

    let out = new Promise((resolve, reject) => {
        activity_promise.then((activity) => {
            let msg = activity.value.content;

            let actor_promise = get_json_from_blob(msg.actor.otherData);
            let object_promise = get_json_from_blob(msg.object.otherData);

            Promise.all([actor_promise, object_promise]).then(([actor_data, object_data]) => {
                msg.type = msg.type.substr(3);

                delete msg.actor.otherData;
                for (let key in actor_data){
                    msg.actor[key] = actor_data[key];
                }

                delete msg.object.otherData;
                for (let key in object_data){
                    msg.object[key] = object_data[key];
                }

                resolve(msg);
            })
        });
        activity_promise.catch(() => {
            reject('id did not work');
        });
    });

    return await out;
}

exports.bridge = {
    save : (message) => {
        if (message.@context === "https://www.w3.org/ns/activitystreams") {

            add_ssb_message(
                message.type,
                message.id,
                message.actor,
                message.summary || "",
                message.object,
                message.origin || null,
                message.target || null
            )

        } else {
            throw ("Invalid message context.");
        }
    },
    restore: (id) => {
        let p = restore_ssb_message(id);

        return p;
    }
};
