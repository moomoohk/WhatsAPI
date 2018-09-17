/**
 * This script contains WAPI functions that need to be run in the context of the webpage
 */


window.WAPI = {
    lastRead: {}
};

/**
 * Auto discovery the webpack object references of instances that contains all functions used by the WAPI
 * functions and creates the Store object.
 */
window.WAPI.createStore = function () {
    if (!window.Store) {
        (function () {
            function getStore(modules) {
                let foundCount = 0;
                let neededObjects = [
                    {id: "Store", conditions: (module) => (module.Chat && module.Msg) ? module : null},
                    {id: "Wap", conditions: (module) => (module.createGroup) ? module : null},
                    {
                        id: "MediaCollection",
                        conditions: (module) => (module.default && module.default.prototype && module.default.prototype.processFiles !== undefined) ? module.default : null
                    },
                    {
                        id: "WapDelete",
                        conditions: (module) => (module.sendConversationDelete && module.sendConversationDelete.length == 2) ? module : null
                    },
                    {
                        id: "Conn",
                        conditions: (module) => (module.default && module.default.ref && module.default.refTTL) ? module.default : null
                    },
                    {id: "WapQuery", conditions: (module) => (module.queryExist) ? module : null},
                    {
                        id: "ProtoConstructor",
                        conditions: (module) => (module.prototype && module.prototype.constructor.toString().indexOf('binaryProtocol deprecated version') >= 0) ? module : null
                    },
                    {
                        id: "UserConstructor",
                        conditions: (module) => (module.default && module.default.prototype && module.default.prototype.isServer && module.default.prototype.isUser) ? module.default : null
                    }
                ];

                for (let idx in modules) {
                    if ((typeof modules[idx] === "object") && (modules[idx] !== null)) {
                        let first = Object.values(modules[idx])[0];
                        if ((typeof first === "object") && (first.exports)) {
                            for (let idx2 in modules[idx]) {
                                let module = modules(idx2);
                                if (!module) {
                                    continue;
                                }

                                neededObjects.forEach((needObj) => {
                                    if (!needObj.conditions || needObj.foundedModule) return;
                                    let neededModule = needObj.conditions(module);
                                    if (neededModule !== null) {
                                        foundCount++;
                                        needObj.foundedModule = neededModule;
                                    }
                                });

                                if (foundCount === neededObjects.length) {
                                    break;
                                }
                            }

                            let neededStore = neededObjects.find((needObj) => needObj.id === "Store");
                            window.Store = neededStore.foundedModule ? neededStore.foundedModule : {};
                            neededObjects.splice(neededObjects.indexOf(neededStore), 1);
                            neededObjects.forEach((needObj) => {
                                if (needObj.foundedModule) {
                                    window.Store[needObj.id] = needObj.foundedModule;
                                }
                            });

                            return window.Store;
                        }
                    }
                }
            }

            webpackJsonp([], {'parasite': (x, y, z) => getStore(z)}, 'parasite');
        })();
    }
};

/**
 * Take objects and resolve potentially recursive fields so it can be safely serialized.
 * This process prevents Selenium from throwing "unknown error: Maximum call stack size exceeded"
 *
 * @param obj Object to "flatten"
 */
window.WAPI.flattenObject = function (obj) {
    for (const property in obj) {
        if (obj[property] && typeof(obj[property].all) !== "undefined") {
            obj[property] = obj[property].all;
        }
    }

    return obj;
};

/**
 * Fetches all contact objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of contacts
 */
window.WAPI.getAllContacts = function (done) {
    const contacts = Store.Contact.models
        .filter((contact) => contact.all.isMyContact)
        .map((contact) => WAPI.flattenObject(contact.all));

    if (done !== undefined) {
        done(contacts);
    } else {
        return contacts;
    }
};

/**
 * Fetches contact object from store by ID
 *
 * @param id ID of contact
 * @param done Optional callback function for async execution
 * @returns {T|*} Contact object
 */
window.WAPI.getContact = function(id, done) {
    const found = Store.Contact.models.find((contact) => contact.id.toString() === id);

    if (done !== undefined) {
        done(WAPI.flattenObject(found.all));
    } else {
        return WAPI.flattenObject(found.all);
    }
};

window.WAPI.getContactByName = function (name, done) {
    const found = Store.Contact.models.find((contact) => contact.name === name);

    if (done !== undefined) {
        done(WAPI.flattenObject(found.all));
    } else {
        return WAPI.flattenObject(found.all);
    }
};

/**
 * Fetches all chat objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chats
 */
window.WAPI.getAllChats = function (done) {
    const chats = Store.Chat.models.map((chat) => WAPI.flattenObject(chat.all));

    if (done !== undefined) {
        done(chats);
    } else {
        return chats;
    }
};

/**
 * Fetches chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns {T|*} Chat object
 */
window.WAPI.getChat = function(id, done) {
    let found = Store.Chat.models.find((chat) => chat.id.toString() === id);

    if (found !== undefined) {
        found = WAPI.flattenObject(found.all);

        // Done to prevent stack overflow
        // TODO: Find better way
        delete found.msgChunks;
        delete found.mute;
        delete found.presence;
        delete found.contact;
        delete found.previewMessage;
    }

    if (done !== undefined) {
        done(found);
    } else {
        return found;
    }
};

/**
 * Fetches all group metadata objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of group metadata
 */
window.WAPI.getAllGroupMetadata = function(done) {
    const groupData = Store.GroupMetadata.models.map((groupData) => WAPI.flattenObject(groupData.all));

    if (done !== undefined) {
        done(groupData);
    } else {
        return groupData;
    }
};

/**
 * Fetches group metadata object from store by ID
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {T|*} Group metadata object
 */
window.WAPI.getGroupMetadata = async function(id, done) {
    let found = Store.GroupMetadata.models.find((groupData) => groupData.id.toString() === id);

    if (found !== undefined) {
        if (found.stale) {
            await found.update();
        }
    }

    if (done !== undefined) {
        done(WAPI.flattenObject(found));
    } else {
        return WAPI.flattenObject(found);
    }
};

/**
 * Fetches group participants
 *
 * @param id ID of group
 * @returns {Promise.<*>} Yields group metadata
 * @private
 */
window.WAPI._getGroupParticipants = async function(id) {
    const metadata = await WAPI.getGroupMetadata(id);
    return metadata.participants;
};

/**
 * Fetches IDs of group participants
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {Promise.<Array|*>} Yields list of IDs
 */
window.WAPI.getGroupParticipantIDs = async function(id, done) {
    const participants = await WAPI._getGroupParticipants(id);

    const ids = participants.map((participant) => WAPI.flattenObject(participant.id));

    if (done !== undefined) {
        done(ids);
    } else {
        return ids;
    }
};

window.WAPI.getGroupAdmins = async function(id) {
    const participants = await WAPI._getGroupParticipants(id);
    return participants
        .filter((participant) => participant.isAdmin)
        .map((admin) => admin.id);
};

/**
 * Gets object representing the logged in user
 *
 * @returns {Array|*|$q.all}
 */
window.WAPI.getMe = function (done) {
    const contacts = window.Store.Contact.models;

    const rawMe = contacts.find((contact) => contact.all.isMe, contacts);

    let all = rawMe.all;
    for (const property in all) {
        if (all[property] && typeof(all[property].all) !== "undefined") {
            all[property] = all[property].all;
        }
    }

    if (done !== undefined) {
        done(all);
    } else {
        return all;
    }
};


// FUNCTIONS UNDER THIS LINE ARE UNSTABLE

window.WAPI.getAllMessagesInChat = function (id, includeMe) {
    id = typeof id === "string" ? id : id._serialized;
    const chat = window.Store.Chat.get(id);
    // let messages = chat.msgs.models;

    let output = [];

    const messages = chat.msgs.models;
    for (const i in messages) {
        if (i === "remove") {
            continue;
        }

        const messageObj = messages[i];
        messageObj.initialize();

        if (messageObj.isNotification) {
            // System message
            // (i.e. "Messages you send to this chat and calls are now secured with end-to-end encryption...")
            continue;
        }

        if (messageObj.id.fromMe === false || includeMe) {
            // const senderObj = messageObj.all.senderObj.all;
            let message = WAPI.flattenObject(messageObj.all);
            message.senderObj = WAPI.flattenObject(message.senderObj);
            message.chat = WAPI.flattenObject(message.chat.all);
            delete message.msgChunk;
            // message.senderObj = message.senderObj.all;
            output.push(message);
        }
    }

    WAPI.lastRead[chat.name] = Math.floor(Date.now() / 1000);

    console.log(output);
    return output;
};

window.WAPI.sendMessage = function (id, message) {
    const Chats = Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].__x__formattedTitle;
        temp.id = Chats[chat].__x_id;
        if (temp.id.toString() === id) {
            Chats[chat].sendMessage(message);

            return true;
        }
    }

    return false;
};

window.WAPI.getUnreadMessagesInChat = function (id, includeMe, includeNotifications, done) {
    // get chat and its messages

    id = typeof id === "string" ? id : id._serialized;
    const chat = window.Store.Chat.get(id);
    let messages = chat.msgs.models;

    // initialize result list
    let output = [];

    // look for unread messages, newest is at the end of array
    for (let i = messages.length - 1; i >= 0; i--)
    {
        // system message: skip it
        if (i === "remove") {
            continue;
        }

        // get message
        let messageObj = messages[i];

        // found a read message: stop looking for others
        if (typeof (messageObj.isNewMsg) !== "boolean" || messageObj.isNewMsg === false) {
            continue;
        } else {
            messageObj.isNewMsg = false;
            // process it
            let message = WAPI.flattenObject(messageObj);

            // save processed message on result list
            if (message)
                output.push(message);
        }
    }
    // callback was passed: run it
    if (done !== undefined) done(output);
    // return result list
    return output;
};

window.WAPI.getUnreadMessages = function () {
    const chats = Store.Chat.models.map((chat) => WAPI.flattenObject(chat.all));

     WAPI.lastRead = {};
     for (let chat in chats) {
         if (isNaN(chat)) {
             continue;
         }

         WAPI.lastRead[chats[chat].name] = Math.floor(Date.now() / 1000);
     }

    let output = [];
    for (let chat in chats) {
        if (isNaN(chat)) {
            continue;
        }

        let messageGroupObj = chats[chat];

        let messageGroup = WAPI.flattenObject(messageGroupObj);
        messageGroup.messages = [];

        const messages = messageGroupObj.msgs.models;
        for (let i = messages.length - 1; i >= 0; i--) {
            let messageObj = messages[i];

            if (messageObj.isNotification) {
                // System message
                // (i.e. "Messages you send to this chat and calls are now secured with end-to-end encryption...")
                continue;
            }

            if (messageObj.t <= WAPI.lastRead[messageGroupObj.name] || messageObj.id.fromMe === true) {
                break;
            } else {
                let message = WAPI.flattenObject(messageObj);

                messageGroup.messages.push(message);
            }
        }

        WAPI.lastRead[messageGroupObj.name] = Math.floor(Date.now() / 1000);

        if (messageGroup.messages.length > 0) {
            output.push(messageGroup);
        }
    }

    return output;
};

window.WAPI.getCommonGroups = function(id) {
    // return
};

window.WAPI.getGroupOwnerID = async function(id) {
    return WAPI.getGroupMetadata(id).owner.id;
};