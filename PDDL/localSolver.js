import fetch from 'node-fetch';

const HOST = 'http://localhost:5555';
const PATH ='/package/dual-bfws-ffparser/solve';

/**
 * @typedef { { parallel: boolean, action: string, args: string [] } } pddlPlanStep
 */


/**
 * @param {String} pddlDomain 
 * @param {String} pddlProblem 
 * @returns { Promise < pddlPlanStep [] > }
 */
export default async function localSolver (pddlDomain, pddlProblem) {

    var json = await getResult(pddlDomain, pddlProblem);
    if (json == "") return [];

    var plan = parsePlan(json);
    
    return plan;
}

async function getResult (pddlDomain, pddlProblem) {
    if ( typeof pddlDomain !== 'string' && ! pddlDomain instanceof String )
        throw new Error( 'pddlDomain is not a string' );

    if ( typeof pddlProblem !== 'string' && ! pddlProblem instanceof String )
        throw new Error( 'pddlProblem is not a string' );


    while (true) {

        let res = await fetch( HOST + PATH, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify( {domain: pddlDomain, problem: pddlProblem} )
        })

        if ( res.status != 200 ) {
            throw new Error( `Received HTTP error from ${ HOST + res.result } ` + await res.text() );
        }
    
        var json = await res.json();

        if ( json.status === 'PENDING') {
            await new Promise( (res, rej) => setTimeout(res, 100) );
        }
        else
            break;

    }

    
    if ( ! 'stdout' in json ) {
        console.log(json);
        throw new Error( `No 'result.stdout' in response` );
    }

    return json;

}


async function parsePlan (json) {

    /**@type {[string]}*/
    var lines = [];
    if(json.plan==='') return;
    if ( json.plan ) {
        lines = json.plan.split('\n');
    }

    // PARSING plan from /package/dual-bfws-ffparser/solve
    if ( json.stdout.split('\n').includes(' --- OK.') ) {

        // console.log( '\tUsing parser for /package/dual-bfws-ffparser/solve');

        lines = lines.map( line => line.replace('(','').replace(')','').split(' ') );
        lines = lines.slice(0,-1);
    }

    // PARSING plan from /package/delfi/solve
    else if ( json.stdout.split('\n').includes('Solution found.') ) {
        

        lines = lines.map( line => line.replace('(','').replace(')','').split(' ') );
        lines = lines.slice(0,-1);
    }

    // PARSING plan from /package/enhsp-2020/solve
    else if ( lines.includes('Problem Solved') ) {


        let startIndex = lines.indexOf('Problem Solved') + 1;
        let endIndex = lines.findIndex( (line) => line.includes('Plan-Length') );
        lines = lines.slice( startIndex, endIndex );
        
        lines = lines.map( line => line.replace('(','').replace(')','').split(' ').slice(1) );
    }

    else if ( lines.includes(';;;; Solution Found') ) {
        
        let startIndex = lines.indexOf(';;;; Solution Found') + 1;
        lines = lines.slice( startIndex + 3 );

        lines = lines.map( line => line.replace('(','').replace(')','').split(' ').slice(1, -1) );
        lines = lines.slice(0,-1);
    }

    else if ( json.stdout.includes('Solution found!') ) {
        
        lines = json.output.sas_plan.split('\n').slice(0,-2);
        lines = lines.map( line => line.replace('(','').replace(')','').split(' ') );
    }

    // ERROR
    else {
        return;
    }

    var plan = []


    for ( let /**@type {string}*/ line of lines ) {

        var action = line.shift()
        var args = line
        
        plan.push( { parallel: false/*number==previousNumber*/, action: action, args: args } );
    }
    
    return plan;

}