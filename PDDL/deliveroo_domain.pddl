(define (domain delivery-domain)
    (:requirements :strips :typing :fluents)

    (:types agent parcel coordinate)

    (:predicates 
        (at ?agent - agent ?x - coordinate ?y - coordinate) ; Agent's position
        (empty ?x - coordinate ?y - coordinate) ; Empty cell
        (delivery ?x - coordinate ?y - coordinate) ; Delivery cell
        (adjacent ?x1 - coordinate ?y1 - coordinate ?x2 - coordinate ?y2 - coordinate) ; Adjacency
    )

    (:functions
        (path-cost) ; Numeric value to track path cost
    )

    (:action move
        :parameters (?agent - agent ?x1 - coordinate ?y1 - coordinate ?x2 - coordinate ?y2 - coordinate)
        :precondition (and 
            (at ?agent ?x1 ?y1) 
            (adjacent ?x1 ?y1 ?x2 ?y2)
            (empty ?x2 ?y2)
        )
        :effect (and 
            (not (at ?agent ?x1 ?y1))
            (at ?agent ?x2 ?y2)
            (increase (path-cost) 1)
        )
    )
)