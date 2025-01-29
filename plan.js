import { onlineSolver } from "@unitn-asa/pddl-client";
import localSolver from "./localSolver.js";
import fs from 'fs';
import { Agent } from "./agent.js";

function readFile(path) {
    return new Promise((res, rej) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) rej(err)
            else res(data)
        })
    })
}
const domain = await readFile('./deliveroo_domain.pddl');


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

export class Plan {
    #stopped = false;
    agent = null;

    stop() {
        this.#stopped = true;
    }
    get stopped() {
        return this.#stopped;
    }
    checkStop() {
        if (this.stopped) {
            this.#stopped = false;
            throw ['stopped'];
        }
    }

    constructor(agent) {
        this.agent = agent;
    }

    async executePlan(myAgent, p) {
        while (p.length > 0) {
            this.checkStop();
            let current = p.shift();
            if (current.action == 'MOVE') {
                let x1 = current.args[1].replace('X', ''), y1 = current.args[2].replace('Y', '');
                let x2 = current.args[3].replace('X', ''), y2 = current.args[4].replace('Y', '');
                let mov = (x1 - x2) == 1 ? 'left' : (x1 - x2) == -1 ? 'right' : (y1 - y2) == 1 ? 'down' : 'up';
                //console.log('move', mov, x1, y1, x2, y2);
                await move(myAgent, { x: x2, y: y2, mov: mov });
                this.checkStop();
                myAgent.intention_queue = await myAgent.map.reconsider(myAgent.intention_queue, myAgent.id, myAgent.x, myAgent.y);
            }
        }
    }
}

export class GoPickUp extends Plan {
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        //return desire == 'go_pick_up';
        //console.log("Testing [GoPickUp] ------- ")
        if (desire != 'go_pick_up')
            return false;
        //console.log("PLAN [GoPickUp]: CHECKING IF GO TO PICK UP IS APPLICABLE")
        for (const ally of Object.keys(allies)) {
            //console.log("For loop")
            //console.log("ally", allies[ally])

            if (allies[ally].intention != null && allies[ally].intention.desire == 'go_pick_up' && desire == 'go_pick_up') {
                //console.log("primo if done")
                if (allies[ally].intention.args.length <= 0) {
                    //console.log("faccio il continue")
                    //console.log("allies[ally].intention.args", allies[ally].intention.args)
                    continue;
                }

                let allies_intention_args = allies[ally].intention.args[0]
                //console.log("allies[ally]", allies[ally])
                //console.log("allies[ally].intention.args", allies_intention_args)
                //console.log("[GoPickUp]")
                //console.log("id parcel 1 ", intention_queue[0].args[0].id)
                //console.log("id parcel 2 ", allies_intention_args.id)
                if (allies_intention_args.carriedBy != null || intention_queue[0].args[0].id != allies_intention_args.id)
                    continue;

                ////console.log("primo if --------------------------")
                if (!isNaN(allies[ally].x) && !isNaN(allies[ally].y) && !isNaN(allies_intention_args.x) && !isNaN(allies_intention_args.y)) {
                    //console.log("secondo if done")
                    let my_plan = await map.bfs(x, y, 'C', allies_intention_args.x, allies_intention_args.y);
                    let allay_plan = await map.bfs(allies[ally].x, allies[ally].y, 'C', allies_intention_args.x, allies_intention_args.y);

                    //let allay_parcel = allay_plan[allay_plan.lenght - 1]
                    /*console.log("my_plan", my_plan)
                    console.log("allay_plan", allay_plan)
                    console.log(x, y)
                    console.log(allies[ally].x, allies[ally].y)
                    console.log(parcel.x, parcel.y)
                    console.log(allies_intention_args.x, allies_intention_args.y)*/
                    //if (my_parcel.x == allay_parcel.x && my_parcel.y == allay_parcel.y) {
                    // we have the same intention, proceed only if the closest agent

                    //console.log("[Sono in isApplicableTo")
                    //console.log("WE HAVE THE SAME INTETION, TO GO TO THE SAME PARCEL")
                    //console.log(x, y)
                    //console.log(allies[ally].x, allies[ally].y)
                    //console.log("my_plan", my_plan)
                    //console.log("allay_plan", allay_plan)

                    if (my_plan.length > allay_plan.length) {
                        //return false
                        // TODO: could be problematic for the reconsider function
                        //console.log("ANNULLO LA MIA INTENTION, VAI SOCIO")
                        //console.log("--------------------\n\n\n\n\n\n\n")
                        return false
                    } else {
                        //console.log("CONTINUO LA MIA INTENTION")
                    }
                    //console.log("--------------------\n\n\n\n\n\n\n")
                    //}
                }
            }
        }
        //console.log("---- returning true from plan")
        return desire == 'go_pick_up';
    }

    async execute(myAgent, { x, y }) {
        console.log("Executing [GoPickUp] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlGoTo(myAgent.x, myAgent.y, x, y);
        if (config_host.local_solver)
            var p = await localSolver(domain, problem)
        else
            var p = await onlineSolver(domain, problem);
        await this.executePlan(myAgent, p);
        this.checkStop();
        return true;
    }
}

export class GoToDelivery extends Plan {
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        return desire == 'go_to_delivery';
    }

    async execute(myAgent) {
        console.log("Executing [GoToDelivery] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlDelivery(myAgent.x, myAgent.y);
        if (config_host.local_solver)
            var p = await localSolver(domain, problem)
        else
            var p = await onlineSolver(domain, problem);
        //console.log("Response from solver", p);
        await this.executePlan(myAgent, p);
        await myAgent.client.putdown();
        this.checkStop();
        return true;
    }
}

export class Explore extends Plan {
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        console.log("Testing [Explore] ------- ")
        return desire == 'explore';
    }

    async execute(myAgent, { x, y }) {
        console.log("Executing [Explore] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlGoTo(myAgent.x, myAgent.y, x, y);
        if (config_host.local_solver)
            var p = await localSolver(domain, problem)
        else
            var p = await onlineSolver(domain, problem);
        if (p != null) { // se non c'è un percorso valido
            await this.executePlan(myAgent, p);
            await myAgent.client.pickup();
            this.checkStop();
            return true;
        } else {
            return false;
        }
    }
}

async function move(myAgent, current) {
    if (myAgent.map.amap[myAgent.x][myAgent.y] == -1) {
        await myAgent.client.putdown();
    }

    if (myAgent.map.isParcel(myAgent.x, myAgent.y)) {
        if (myAgent.map.availableParcels[myAgent.map.amap[myAgent.x][myAgent.y]].carriedBy != myAgent.id) {
            await myAgent.client.pickup();
        }
    }

    if (! await myAgent.client.move(current.mov)) {
        throw new Error('move failed');
    }

    if (current.x != myAgent.x || current.y != myAgent.y) {
        //console.log('desync', current.x, current.y, myAgent.x, myAgent.y);
        await myAgent.client.putdown();
        await myAgent.client.pickup();
        throw new Error('desync');
    }
}