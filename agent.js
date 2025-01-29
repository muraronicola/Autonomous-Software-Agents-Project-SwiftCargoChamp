import { Intention } from './intention.js';

export class Agent {
    constructor(client) {
        this.client = client;
        this.intention_queue = [];
        this.active = false;
        this.x;
        this.y;
        this.id;
        this.a_name;
        this.score;
        this.map;
        this.plans = [];
        this.allies = {};
    }

    async intentionLoop() {
        this.active = true;
        console.log('while true');
        while (true) {
            console.log('while true');

            ////console.log('available parcels', this.map.availableParcels);
            if (Object.keys(this.map.availableParcels).some(k => this.map.availableParcels[k].carriedBy == this.id)) {
                //console.log('pushing go_to_delivery');
                this.push('go_to_delivery')
            }
            if (this.intention_queue.length > 0) {
                this.intention_queue = await this.map.filter_intentions(this.intention_queue, this.id, this.x, this.y); //Il commento è in DEBUG ONLY; DA RIATTIVARE
                console.log('intentions:', this.intention_queue.map(i => i.desire));
                // Current intention
                if (this.intention_queue.length > 0) {
                    const intention = this.intention_queue[0]; //posso non avere più intenzioni
                    try {
                        // inform the allies of the intention
                        console.log('sending intention to allies');
                        //console.log(this.intention_queue.length);
                        //console.log(intention);
                        this.sendToAllies(intention.toMsg());
                        //console.log('intention sent');
                        await intention.achieve(this);
                        //console.log('intention achieved');
                        //this.intention_queue.shift();
                    }
                    catch (error) {
                        //console.log('intention failed with error:', error);
                        //console.log('intention failed');
                    }
                    this.intention_queue.shift();
                    console.log('intention shifted');
                }
            }
            else {
                console.log('pushing explore');
                this.push('explore', await this.map.getSpawner(this.allies, this.x, this.y));
            }

            await new Promise(res => setImmediate(res));
            //await new Promise(res => setTimeout(res, 1000));

            // send map info to allies if there are any
            //this.sendToAllies(this.map.toMsg())

        }
    }

    async push(desire, ...args) {
        if (!this.active)
            return;

        const current = new Intention(desire, ...args)

        // ceck if the intention is already in the queue
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

    async sendToAllies(msg) { //non è che forse crasha qui?
        //return true;
        for (const ally of Object.keys(this.allies)) {
            this.client.say(ally, msg);
        }
    }

    async stop() {
        //console.log('stop agent queued intentions');
        for (const intention of this.intention_queue) {
            intention.stop();
        }
    }
}