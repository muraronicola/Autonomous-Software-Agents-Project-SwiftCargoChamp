import { onlineSolver } from "@unitn-asa/pddl-client";
import localSolver from "./PDDL/localSolver.js";
import fs from 'fs';

/**
 * Load the domain file for the PDDL
 * @param {[string]} path
*/
function readFile(path) {
    return new Promise((res, rej) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) rej(err)
            else res(data)
        })
    })
}
const domain = await readFile('./PDDL/deliveroo_domain.pddl');

/**
 * Load the configuration file
 * @param {[string]} fileName
*/
async function loadConfig(fileName) {
    try {
        // Dynamically import the file
        const config = await import(`./${fileName}`);
        return config.default;
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// use the config file passed as argument if any or the default one
const config_host = await loadConfig(process.argv[2] || './config/config_1.js');



export class Plan { 
    #stopped = false;
    agent = null;

    /**
     * Constructor
     * @param {[object]} agent
     */
    constructor(agent) {
        this.agent = agent;
    }

    /**
     * Stop the plan
     */
    stop() {
        this.#stopped = true;
    }

    /**
     * Return the status of the plan
     * @returns {[boolean]}
     */
    get stopped() {
        return this.#stopped;
    }

    /**
     * Check if the plan is stopped
     * @throws {['stopped']}
     */
    checkStop() {
        if (this.stopped) {
            this.#stopped = false;
            throw ['stopped'];
        }
    }

    /**
     * Execute the plan
     * @param {[object]} myAgent
     * @param {[object]} p
     */
    async executePlan(myAgent, p) {
        while (p.length > 0) {
            this.checkStop();
            let current = p.shift();
            if (current.action == 'MOVE') {
                let x1 = current.args[1].replace('X', ''), y1 = current.args[2].replace('Y', '');
                let x2 = current.args[3].replace('X', ''), y2 = current.args[4].replace('Y', '');
                let mov = (x1 - x2) == 1 ? 'left' : (x1 - x2) == -1 ? 'right' : (y1 - y2) == 1 ? 'down' : 'up';
                await move(myAgent, { x: x2, y: y2, mov: mov });
                this.checkStop();
                myAgent.intention_queue = await myAgent.map.reconsider(myAgent.intention_queue, myAgent.id, myAgent.x, myAgent.y);
            }
        }
    }
}



export class GoPickUp extends Plan {

    /**
     * Check if the plan for going to pick up a parcel is applicable
     * @param {[string]} desire
     * @param {[integer]} x
     * @param {[integer]} y
     * @param {[object]} allies
     * @param {[object]} map
     * @param {[object]} intention_queue
     * @returns {[boolean]}
     */
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        if (desire != 'go_pick_up') //If the desire is not to go pick up a parcel, return false
            return false;

        for (const ally of Object.keys(allies)) { //Check if an ally is already going to pick up the parcel and if it is more convenient for him to do it
            if (allies[ally].intention != null && allies[ally].intention.desire == 'go_pick_up' && desire == 'go_pick_up') {
                if (allies[ally].intention.args.length <= 0) {
                    continue;
                }

                let allies_intention_args = allies[ally].intention.args[0]

                if (allies_intention_args.carriedBy != null || intention_queue[0].args[0].id != allies_intention_args.id)
                    continue;

                if (!isNaN(allies[ally].x) && !isNaN(allies[ally].y) && !isNaN(allies_intention_args.x) && !isNaN(allies_intention_args.y)) {
                    let my_plan = await map.bfs(x, y, 'C', allies_intention_args.x, allies_intention_args.y);
                    let allay_plan = await map.bfs(allies[ally].x, allies[ally].y, 'C', allies_intention_args.x, allies_intention_args.y);
                    if (my_plan.length > allay_plan.length) { //If the path is longer for the this agent, return false
                        return false
                    } 
                }
            }
        }

        return desire == 'go_pick_up';
    }

    /**
     * Execute the plan for going to pick up a parcel
     * @param {[object]} myAgent 
     * @param {[x: integer, y: integer]} { x, y } 
     * @returns {[boolean]}
     */
    async execute(myAgent, { x, y }) {
        console.log("Executing [GoPickUp] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlGoTo(myAgent.x, myAgent.y, x, y);
        if (config_host.local_solver) 
            var p = await localSolver(domain, problem);
        else
            var p = await onlineSolver(domain, problem);

        if (p != null) { //If the plan is valid execute it
            await this.executePlan(myAgent, p);
            await myAgent.client.pickup();
            this.checkStop();
            return true;
        } else {
            return false;
        }
    }
}




export class GoToDelivery extends Plan { 
    /**
     * Check if the plan for going to delivery is applicable
     * @param {[string]} desire
     * @param {[integer]} x
     * @param {[integer]} y
     * @param {[object]} allies
     * @param {[object]} map
     * @param {[object]} intention_queue
     * @returns {[boolean]}
     */
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        return desire == 'go_to_delivery';
    }


    /**
     * Execute the plan for going to delivery
     * @param {[object]} myAgent
     * @returns {[boolean]}
     */
    async execute(myAgent) {
        console.log("Executing [GoToDelivery] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlDelivery(myAgent.x, myAgent.y);
        if (config_host.local_solver)
            var p = await localSolver(domain, problem)
        else
            var p = await onlineSolver(domain, problem);

        if (p != null) { //If the plan is valid execute it
            await this.executePlan(myAgent, p);
            await myAgent.client.pickup();
            this.checkStop();
            return true;
        } else {
            return false;
        }
    }
}




export class Explore extends Plan {

    /**
     * Check if the plan for going to explore is applicable
     * @param {[string]} desire
     * @param {[integer]} x
     * @param {[integer]} y
     * @param {[object]} allies
     * @param {[object]} map
     * @param {[object]} intention_queue
     * @returns {[boolean]}
     */
    async isApplicableTo(desire, x, y, allies, map, intention_queue) {
        return desire == 'explore';
    }

    /**
     * Execute the plan for going to explore
     * @param {[object]} myAgent
     * @param {[x: integer, y: integer]} { x, y }
     * @returns {[boolean]}
     */
    async execute(myAgent, { x, y }) {
        console.log("Executing [Explore] ------- ")
        this.checkStop();
        let problem = await myAgent.map.PddlGoTo(myAgent.x, myAgent.y, x, y);
        if (config_host.local_solver)
            var p = await localSolver(domain, problem)
        else
            var p = await onlineSolver(domain, problem);

        if (p != null) { //If the plan is valid execute it
            await this.executePlan(myAgent, p);
            await myAgent.client.pickup();
            this.checkStop();
            return true;
        } else {
            return false;
        }
    }
}


/**
 * Moves the agent to the next position, also picks up and puts down parcels (if needed)
 * @param {object} myAgent 
 * @param {object} current 
 */
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
        if (myAgent.last_position.x != myAgent.x && myAgent.last_position.y != myAgent.y) {
            myAgent.last_position.x = myAgent.x;
            myAgent.last_position.y = myAgent.y;
            myAgent.last_position.time_step = new Date().getTime();
        }
        throw new Error('move failed');

    } else {
        myAgent.last_position.x = -1;
        myAgent.last_position.y = -1;
        myAgent.last_position.time_step = new Date().getTime();
    }


    if (current.x != myAgent.x || current.y != myAgent.y) {
        await myAgent.client.putdown();
        await myAgent.client.pickup();
        throw new Error('desync');
    }
}