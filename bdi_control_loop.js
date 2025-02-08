import { DeliverooApi } from "./API/deliverooApi.js";
import { DeliverooMap } from "./map.js";
import { Agent } from "./agent.js";
import { GoPickUp, GoToDelivery, Explore } from "./plan.js";


/**
 * Load the configuration file
 * @param {[string]} fileName
*/
async function loadConfig(fileName) {
    try {
        const config = await import(`./${fileName}`); // Dynamically import the file
        return config.default;
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// use the config file passed as argument if any or the default one
const config_host = await loadConfig(process.argv[2] || './config/config_1.js');


// Create the DeliverooApi object
const client = new DeliverooApi(config_host.host, config_host.token)
client.onConnect(() => console.log("socket", client.socket.id));
client.onDisconnect(() => console.log("disconnected", client.socket.id));

let config;
client.socket.once('config', (_config) => {
    config = _config;
});

const passkey = 'SwiftCargoChamp';
const myAgent = new Agent(client);




/**
 * Message handling from the server
 * @param {[object]} parameters
 * @param {[string]} parameters.id
 * @param {[string]} parameters.name
 * @param {[number]} parameters.x
 * @param {[number]} parameters.y
 * @param {[number]} parameters.score
 */
client.onYou(({ id, name, x, y, score }) => { 
    myAgent.id = id
    myAgent.a_name = name
    myAgent.x = Math.round(x)
    myAgent.y = Math.round(y)
    myAgent.score = score
    myAgent.sendToAllies(`${passkey}-ack-${myAgent.x}-${myAgent.y}`);
})

/**
 * Agent initialization
 * @param {[object]} parameters
 */
client.socket.once('you', (parameters) => {
    let x = Math.round(parameters.x);
    let y = Math.round(parameters.y);
    client.shout(`${passkey}-hello-${x}-${y}`);
});

/**
 * Agent plan library initialization
 */
myAgent.plans.push(new GoPickUp())
myAgent.plans.push(new GoToDelivery())
myAgent.plans.push(new Explore())

/**
 * Belief initialization of the map
 * @param {[object]} parameters
 */
client.socket.once('map', (width, height, tiles) => {
    myAgent.map = new DeliverooMap(width, height, tiles)
});

/**
 * The server sends the agents information about the agents
 * @param {[object]} sensed_agents
 */
client.onAgentsSensing(sensed_agents => { 
    if (!myAgent.active)
        return;

    myAgent.map.updateAgents(sensed_agents)
});

/**
 * The server sends the agents information about the parcels
 * @param {[object]} parcels
 */
client.onParcelsSensing(async (parcels) => {
    if (!myAgent.active)
        return;

    myAgent.map.updateParcels(parcels, myAgent.x, myAgent.y)
    myAgent.sendToAllies(`${passkey}-parcels-${JSON.stringify(parcels)}`);

    let best_parcels = await myAgent.map.best_parcels(myAgent.x, myAgent.y);
    if (best_parcels.length > 0) {
        for (const p of best_parcels) {
            myAgent.push('go_pick_up', p[0])
        }
    }
});

/**
 * Message handling from an ally
 * @param {[string]} id
 * @param {[string]} _
 * @param {[string]} msg
 */
client.onMsg(async (id, _, msg) => { //There is a message from another agent
    let split = msg.split('-');
    if (split[0] == passkey) { //Check if the message is from our allies
        switch (split[1]) {
            case 'hello':
                myAgent.allies[id] = { id: id, x: parseInt(split[2]), y: parseInt(split[3]), intention: null };
                client.say(id, `${passkey}-ack-${myAgent.x}-${myAgent.y}`);
                break;

            case 'ack':
                let current_intention = null;
                if (myAgent.allies[id] != null) {
                    current_intention = myAgent.allies[id].intention;
                }
                myAgent.allies[id] = { id: id, x: parseInt(split[2]), y: parseInt(split[3]), intention: current_intention };
                break;

            case 'map':
                let info = JSON.parse(split[2]);
                let parcels = info.parcels;
                let agents = info.agents;
                if (Object.keys(parcels).length > 0) {
                    myAgent.map.updateParcels(Object.values(parcels), myAgent.allies[id].x, myAgent.allies[id].y);
                }
                if (Object.keys(agents).length > 0) {
                    myAgent.map.updateAgents(Object.values(agents));
                }
                break;

            case 'parcels':
                myAgent.map.updateParcels(JSON.parse(split[2]), myAgent.allies[id].x, myAgent.allies[id].y);
                break;

            case 'intention':
                let intention = JSON.parse(split[2]);
                myAgent.allies[id].intention = intention;
                console.log("client.onMsg: update-intention", intention)

                switch (intention.desire) {
                    case 'go_pick_up':
                        let parcel = intention.args[0];

                        if (myAgent.intention_queue.length > 0 && myAgent.intention_queue[0].desire == 'go_pick_up') {
                            
                            if (myAgent.intention_queue[0].args[0].id == parcel.id && parcel.carriedBy == null)
                                
                                if (!isNaN(myAgent.allies[id].x) && !isNaN(myAgent.allies[id].y) && !isNaN(parcel.x) && !isNaN(parcel.y)) {
                                    let my_plan = await myAgent.map.bfs(myAgent.x, myAgent.y, 'C', parcel.x, parcel.y);
                                    let allay_plan = await myAgent.map.bfs(myAgent.allies[id].x, myAgent.allies[id].y, 'C', parcel.x, parcel.y);
                                    
                                    if (my_plan != null && allay_plan != null) {
                                        if (my_plan.length > allay_plan.length) {
                                            myAgent.intention_queue[0].stop();
                                            myAgent.intention_queue.shift();
                                        }
                                    } else {
                                        if (my_plan == null && allay_plan != null) {
                                            myAgent.intention_queue[0].stop();
                                            myAgent.intention_queue.shift();
                                        }
                                    }
                                }
                        }
                        break;

                    case 'go_to_delivery':
                        if (myAgent.intention_queue.length > 0 && myAgent.intention_queue[0].desire == 'go_to_delivery') {
                            let my_plan = await myAgent.map.bfs(myAgent.x, myAgent.y, 'D');
                            let allay_plan = await myAgent.map.bfs(myAgent.allies[id].x, myAgent.allies[id].y, 'D');
                            let my_delivery = my_plan[my_plan.length - 1]
                            let allay_delivery = allay_plan[allay_plan.length - 1]

                            if (my_plan != null && allay_plan != null && my_delivery != null && allay_delivery != null) {

                                if (my_delivery.x == allay_delivery.x && my_delivery.y == allay_delivery.y && myAgent.id > id) {

                                    if (my_plan.length == allay_plan.length) {
                                        myAgent.intention_queue[0].stop();
                                        myAgent.intention_queue.shift();
                                    }
                                }
                            }
                        }
                        break;

                    case 'explore':
                        //do nothing, the handling is already done in the map.getSpawner function
                        break;
                }
                break;
        }
    }
});

/**
 * Waits for the map to be loaded
 */
async function waitForMap() {
    return new Promise((resolve) => {
        client.onMap(() => {
            resolve();
        });
    });
}

/**
 * Waits for the sensing of the parcels
 */
async function waitForSensingP() {
    return new Promise((resolve) => {
        client.onParcelsSensing(() => {
            resolve();
        });
    });
}

/**
 * Waits for the configuration to be loaded
 */
async function waitForConfig() {
    return new Promise((resolve) => {
        client.onConfig(() => {
            resolve();
        });
    });
}

/**
 * Initializes the belief of the agent
 */
async function initialBelief() {
    await waitForConfig();
    await myAgent.map.setConfig(config);
    await waitForSensingP();
}

await initialBelief();
await myAgent.intentionLoop();