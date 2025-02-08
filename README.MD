
# Autonomus Software Agents Project - SwiftCargoChamp

This is our project for the course "Autonomous Software Agents"
<br> <br>

## Running the Code
<br>

## 1. Set up the Project Environment
We expect that the server is already running, provided the repository given by the professor during the classes.

For our part, here are the steps to set up the project environment.


### 1.1 Install npm packages
First of all, we need to install the required dependencies. To do so, run the following command:

```npm install```


### 1.2 Set up the configuration file
There are two default configuration files in the project, both located in the `./config` folder.
They contain the `host`, `token`, and `local_solver` of the agent. By default, we use the online solver, so the project can be always be executed (provided an internet connection). 
By default, the agent will use the `config_1.js` file.


### 1.3 Set up the local solver
If you want to use the local solver, you need to set the `local_solver` to `true` in the configuration file.
The address for the local solver can be specified in the `./PDDL/localSolver.js` file.
<br>
We used the plantilus server, based on docker. For installation follow the instructions in the following link:
https://github.com/AI-Planning/planutils/tree/main/environments/server


<br>

## 2. Execute our agent
For the execution of the code, run the following command:


### 2.1 Default configuration (config_1.js)
```node bdi_control_loop.js``` 


### 2.2 Custom configuration (es: config_2.js)
```node bdi_control_loop.js config_2.js``` 
