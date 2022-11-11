create table "incident" (
    id serial primary key,
    incident_name varchar(255),
    date varchar(64),
    event_id int,
    constraint fk_event
        foreign key(event_id)
            references "event"(id)
);
