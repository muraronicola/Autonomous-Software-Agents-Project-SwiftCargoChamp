# Autonomous Software Agents Project - SwiftCargoChamp

This is our project for the **"Autonomous Software Agents"** course.

<br>

## Running the Code

<br>

## 1. Setting Up the Project Environment

We assume that the server is already running, based on the repository provided by the professor during the course.

For our part, follow these steps to set up the project environment:

### 1.1 Install npm Packages

First, install the required dependencies by running the following command:

```sh
npm install
```

### 1.2 Configure the Project

The project includes two default configuration files, both located in the `./config` folder.  
These files contain the `host`, `token`, and `local_solver` settings for the agent.

By default, the project uses an **online solver**, allowing it to be executed at any time (as long as an internet connection is available).  
Unless otherwise specified, the agent will use the `./config/config_1.js` file.

### 1.3 Setting Up the Local Solver

If you prefer to use a **local solver**, improving the performance of the agent by doing so, set the `local_solver` option to `true` in the configuration file.  
You can specify the local solver address in the `./PDDL/localSolver.js` file.

We used the **Planutils server**, which is Docker-based. To install it, follow the instructions provided at the following link: [Planutils Server Installation](https://github.com/AI-Planning/planutils/tree/main/environments/server)

<br>

## 2. Running the Agent

To execute the code, navigate to the `Autonomous-Software-Agents-Project-SwiftCargoChamp` folder and run one of the following commands:

### 2.1 Default Configuration (`config_1.js`)

```sh
node bdi_control_loop.js
```

### 2.2 Custom Configuration (e.g., `config_2.js`)

```sh
node bdi_control_loop.js ./config/config_2.js
