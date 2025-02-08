import { Intention } from './intention.js';

export class Agent {
    /**
     * Constructor
     * @param {[object]} client
     */
    constructor(client) {
        this.client = client;
        this.intention_queue = [];
        this.active = false;
        this.x;
        this.y;
        this.last_position = { x: -1, y: -1, time_step: -1 };
        this.id;
        this.a_name;
        this.score;
        this.map;
        this.plans = [];
        this.allies = {};
    }

    /**
     * Intention loop of the agent
     * @param {[object]} client
     */
    async intentionLoop() {
        this.active = true;

        while (true) {

            if (this.last_position.x == this.x && this.last_position.y == this.y && new Date().getTime() - this.last_position.time_step > 5000) { //If we are stuck for more than 5 seconds
                console.log("I'm stuck: pushing explore");
                this.push('explore', await this.map.getSpawner(this.allies, this.x, this.y));

                if (this.intention_queue.length > 0) {
                    const intention = this.intention_queue[0];
                    try {
                        console.log('sending intention to allies');
                        this.sendToAllies(intention.toMsg());
                        await intention.achieve(this);
                    }
                    catch (error) {
                        console.log('intention failed with error:', error);
                    }
                    this.intention_queue.shift();
                    console.log('intention shifted');
                }

            } else {
                if (Object.keys(this.map.availableParcels).some(k => this.map.availableParcels[k].carriedBy == this.id)) {
                    console.log('pushing go_to_delivery');
                    this.push('go_to_delivery')
                }

                if (this.intention_queue.length > 0) {
                    this.intention_queue = await this.map.filter_intentions(this.intention_queue, this.id, this.x, this.y); //Il commento è in DEBUG ONLY; DA RIATTIVARE
                    if (this.intention_queue.length == 0) {
                        console.log('pushing explore');
                        this.push('explore', await this.map.getSpawner(this.allies, this.x, this.y));
                        this.intention_queue = await this.map.filter_intentions(this.intention_queue, this.id, this.x, this.y); //Il commento è in DEBUG ONLY; DA RIATTIVARE
                    }

                    // Current intention
                    if (this.intention_queue.length > 0) {
                        const intention = this.intention_queue[0];
                        try {
                            console.log('sending intention to allies');
                            this.sendToAllies(intention.toMsg());
                            await intention.achieve(this);
                        }
                        catch (error) {
                            console.log('intention failed with error:', error);
                        }
                        this.intention_queue.shift();
                        console.log('intention shifted');
                    }
                }
                else {
                    console.log('pushing explore');
                    this.push('explore', await this.map.getSpawner(this.allies, this.x, this.y));
                }
            }

            await new Promise(res => setImmediate(res));
        }
    }

    /**
     * Push an intention in the queue
     * @param {[string]} desire 
     * @param {[...any]} args 
     */
    async push(desire, ...args) {
        if (!this.active)
            return;

        const current = new Intention(desire, ...args)

        //Check if the intention is already in the queue, if yes don't push it again
        if (desire == 'go_pick_up') {
            const parcel = args[0];
            if (this.intention_queue.some(i => i.desire == 'go_pick_up' && i.args[0].id == parcel.id))
                return
        }
        else if (desire == 'go_to_delivery' || desire == 'explore') {
            if (this.intention_queue.some(i => i.desire == desire))
                return
        }

        this.intention_queue.push(current);
    }

    /**
     * Share the intention with all the allies
     * @param {[string]} msg 
     */
    async sendToAllies(msg) {
        for (const ally of Object.keys(this.allies)) {
            this.client.say(ally, msg);
        }
    }

    /**
     * Stop the agent intentions
     */
    async stop() {
        for (const intention of this.intention_queue) {
            intention.stop();
        }
    }
}