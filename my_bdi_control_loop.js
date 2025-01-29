import { DeliverooApi } from "./deliverooApi.js";
import { DeliverooMap } from "./map.js";
import { Agent } from "./agent.js";
import { GoPickUp, GoToDelivery, Explore } from "./plan.js";

async function loadConfig(fileName) {
    try {
        // Dynamically import the file
        const config = await import(`./${fileName}`);
        //console.log('Config loaded:', config.default);
        return config.default;
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// use the config file passed as argument if any or the default one
const config_host = await loadConfig(process.argv[2] || 'config_my.js');

const client = new DeliverooApi(config_host.host, config_host.token)
client.onConnect(() => console.log("socket", client.socket.id));
client.onDisconnect(() => console.log("disconnected", client.socket.id));

let config;
client.socket.once('config', (_config) => {
    config = _config;
});

let update_every = 1000;
let last_update = Date.now()
let contatore = 0
/**
 * Belief revision function
 */
const passkey = 'SwiftCargoChamp';
const myAgent = new Agent(client);
client.onYou(({ id, name, x, y, score }) => { //forse posso toglire async
    myAgent.id = id
    myAgent.a_name = name
    myAgent.x = Math.round(x)
    myAgent.y = Math.round(y)
    myAgent.score = score
    /*
    let my_intention = '{"intention":"null"}'
    if (myAgent.intention_queue.length > 0) {
        my_intention = JSON.stringify(myAgent.intention_queue[0])
    }
    console.log("I'm sending ", `${passkey}-ack-${myAgent.x}-${myAgent.y}-${my_intention}`)
    console.log(contatore)
    contatore++
    console.log("")
    myAgent.sendToAllies(`${passkey}-ack-${myAgent.x}-${myAgent.y}-${my_intention}`); //forse posso toglire await
    */
    myAgent.sendToAllies(`${passkey}-ack-${myAgent.x}-${myAgent.y}`);
})

client.socket.once('you', (parameters) => {
    let x = Math.round(parameters.x);
    let y = Math.round(parameters.y);
    client.shout(`${passkey}-hello-${x}-${y}`);
});

/**
 * Agent plan library
 */
myAgent.plans.push(new GoPickUp())
myAgent.plans.push(new GoToDelivery())
myAgent.plans.push(new Explore())

/**
 * Belief and intention initialisation
 */
client.socket.once('map', (width, height, tiles) => {
    myAgent.map = new DeliverooMap(width, height, tiles)
    //console.log('map', width, height)
});

async function print_intentions(intentions) {
    //console.log('intentions:[');
    for (const i of intentions) {
        if (i.desire == 'go_pick_up') {
            //console.log(i.desire + ' ' + i.args[0].id);
        }
        else {
            //console.log(i.desire);
        }
    }
    //console.log(']\n');
}

client.onAgentsSensing(sensed_agents => {
    if (!myAgent.active)
        return;

    myAgent.map.updateAgents(sensed_agents)
});

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
 * Message handling
 * Message format: passkey-[action]-[optional_data]
 */
client.onMsg(async (id, _, msg) => {
    //console.log("client.onMsg", id, msg)
    let split = msg.split('-');
    if (split[0] == passkey) {
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

                //qui devo controllare che esista il campo desire??
                switch (intention.desire) {
                    case 'go_pick_up':
                        console.log("[LOG OP] Il socio va al pick up")
                        let parcel = intention.args[0];
                        //console.log("[msg_recieved]")

                        if (myAgent.intention_queue.length > 0 && myAgent.intention_queue[0].desire == 'go_pick_up') {
                            //console.log("\n\n[Sono in client.onMsg]")
                            //console.log("WE HAVE THE SAME INTETION, TO GO TO THE SAME PARCEL")
                            //console.log(myAgent.x, myAgent.y)
                            //console.log(myAgent.allies[id].x, myAgent.allies[id].y)
                            //console.log(parcel.x, parcel.y)
                            //console.log("id parcel 1 ", myAgent.intention_queue[0].args[0].id)
                            //console.log("id parcel 2 ", parcel.id)
                            if (myAgent.intention_queue[0].args[0].id == parcel.id && parcel.carriedBy == null)
                                if (!isNaN(myAgent.allies[id].x) && !isNaN(myAgent.allies[id].y) && !isNaN(parcel.x) && !isNaN(parcel.y)) {
                                    let my_plan = await myAgent.map.bfs(myAgent.x, myAgent.y, 'C', parcel.x, parcel.y);
                                    let allay_plan = await myAgent.map.bfs(myAgent.allies[id].x, myAgent.allies[id].y, 'C', parcel.x, parcel.y);
                                    //console.log("All intention queue", myAgent.intention_queue)
                                    //console.log("my_plan", my_plan)
                                    //console.log("allay_plan", allay_plan)
                                    if (my_plan != null && allay_plan != null) {
                                        if (my_plan.length > allay_plan.length) {
                                            //console.log("ANNULLO KING")
                                            myAgent.intention_queue[0].stop();
                                            myAgent.intention_queue.shift();
                                        } else {
                                            //console.log("CONTINUO KING")
                                        }
                                    } else {
                                        if (my_plan == null && allay_plan != null) {
                                            //console.log("Io sono nullo")
                                            //console.log("ANNULLO KING")
                                            myAgent.intention_queue[0].stop();
                                            myAgent.intention_queue.shift();
                                        } else if (allay_plan == null && my_plan != null) {
                                            //console.log("Lui è nullo")
                                            //console.log("CONTINUO KING")
                                        }

                                        //console.log("I piani sono nulli.......")
                                        //console.log("my_plan", my_plan)
                                        //console.log("allay_plan", allay_plan)
                                    }
                                    //console.log("------------------------------\n\n\n\n")
                                }
                        }
                        break;

                    case 'go_to_delivery':
                        console.log("[LOG OP] Il socio va al delivery")
                        //if(myAgent.intention_queue.length > 0 && myAgent.intention_queue[0].desire == 'go_to_delivery')
                        // for now do nothing
                        ////console.log("[LOG OP] Il socio sta andando a consegnare")
                        if (myAgent.intention_queue.length > 0 && myAgent.intention_queue[0].desire == 'go_to_delivery') {
                            let my_plan = await myAgent.map.bfs(myAgent.x, myAgent.y, 'D');
                            //console.log("plan_my", my_plan)
                            let allay_plan = await myAgent.map.bfs(myAgent.allies[id].x, myAgent.allies[id].y, 'D');
                            //console.log("plan_ally", allay_plan)
                            let my_delivery = my_plan[my_plan.length - 1]
                            let allay_delivery = allay_plan[allay_plan.length - 1]

                            if (my_plan != null && allay_plan != null && my_delivery != null && allay_delivery != null) {
                                //console.log(myAgent.x, myAgent.y)
                                //console.log(myAgent.allies[id].x, myAgent.allies[id].y)
                                //console.log(my_delivery.x, my_delivery.y)

                                if (my_delivery.x == allay_delivery.x && my_delivery.y == allay_delivery.y && myAgent.id > id) {
                                    // we have the same intention, proceed only if the closest agent
                                    //console.log("WE HAVE THE SAME INTETION, TO GO TO THE SAME DELIVERY")

                                    if (my_plan.length == allay_plan.length) {
                                        //console.log("All intention queue", myAgent.intention_queue)
                                        myAgent.intention_queue[0].stop();
                                        myAgent.intention_queue.shift();
                                        // TODO: could be problematic for the reconsider function
                                        //console.log("ANNULLO LA MIA INTENTION, VAI SOCIO")
                                    } else {
                                        //console.log("CONTINUO LA MIA INTENTION")
                                    }
                                    //throw new Error('stopped');
                                    //console.log("--------------------\n\n\n\n\n\n\n")
                                }else{
                                    //console.log("Si fermerà il socio")
                                }
                            }else{
                                //console.log("I piani sono nulli.......")
                            }
                        }
                        break;

                    case 'explore':
                        console.log("[LOG OP] Il socio sta esplorando")
                        //console.log(intention)
                        // for now do nothing
                        //IDEE
                        //ispezionare parti diverse della mappa
                        break;
                }
                break;
        }
    }
});

async function waitForMap() {
    return new Promise((resolve) => {
        client.onMap(() => {
            resolve();
        });
    });
}

async function waitForSensingP() {
    return new Promise((resolve) => {
        client.onParcelsSensing(() => {
            resolve();
        });
    });
}

async function waitForConfig() {
    return new Promise((resolve) => {
        client.onConfig(() => {
            resolve();
        });
    });
}

async function initialBelief() {
    await waitForConfig();
    await myAgent.map.setConfig(config);
    await waitForSensingP();
    //console.log('Belif initialisation done');
}

await initialBelief();
await myAgent.intentionLoop();