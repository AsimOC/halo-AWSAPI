const {
  INCIDENT_TABLES: TABLES,
  EVENT_TABLES,
  USER_TABLES,
  SCHEMAS,
} = require("../db/tables");
const schema = SCHEMAS.PUBLIC;

const getIncidentQuery = ({ id, excludeDeleted = true }) => `
    SELECT 
        row_to_json(inc.*) as incident,
        row_to_json(ev.*) as event,
        row_to_json(arby.*) as archived_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(rby.*) as reported_by,
        row_to_json(resby.*) as resolved_by,
        row_to_json(cby.*) as created_by,
        row_to_json(uby.*) as updated_by,
        COALESCE(incident_messages.incident_messages, '[]') as incident_messages,
        COALESCE(inc_sub_users.subscribed_users, '[]') as subscribed_users,
		COALESCE(triaging.triaging_allowed_users, '[]') as triaging_allowed_users,
		COALESCE(ready_by.message_ready_by, '[]') as message_read_list,
		ready_by.last_message_created_at as last_message_created_at,
		COALESCE(userviews.userviews, '[]') as user_views
		FROM (SELECT *, ST_AsGeoJSON(location)::jsonb AS location FROM ${
      TABLES.INCIDENT
    }) as inc
			LEFT JOIN (
					SELECT * FROM ${EVENT_TABLES.EVENT} WHERE NOT event_event.deleted
				) as ev
				ON inc.event_id = ev.id
			LEFT JOIN ${USER_TABLES.USER} as arby 
				ON inc.archived_by_id = arby.id
		    LEFT JOIN ${USER_TABLES.USER} as dby
				ON inc.deleted_by_id = dby.id
			LEFT JOIN ${USER_TABLES.USER} as rby
				ON inc.reported_by_id = rby.id
			LEFT JOIN ${USER_TABLES.USER} as resby
				ON inc.resolved_by_id = resby.id
			LEFT JOIN ${USER_TABLES.USER} as cby
				ON inc.created_by_id = cby.id
			LEFT JOIN ${USER_TABLES.USER} as uby
				ON inc.updated_by_id = uby.id
            LEFT JOIN 
					(SELECT inc.id as incident_id, array_to_json(array_agg(inc_mesg.object_id)) as incident_messages from 
					  	${TABLES.INCIDENT} as inc
					  	JOIN ${TABLES.INCIDENT_MESSAGE} as inc_mesg
							ON inc.id = inc_mesg.incident_id 
					    GROUP BY inc.id) AS incident_messages
			    ON incident_messages.incident_id = inc.id
            LEFT JOIN 
					(SELECT inc_sub_users.incident_id as incident_id, array_to_json(array_agg(us.object_id)) as subscribed_users from 
						${TABLES.SUBSCRIBED_USERS} as inc_sub_users
					  	JOIN ${USER_TABLES.USER} as us
							on us.id = inc_sub_users.user_id
					  	GROUP BY inc_sub_users.incident_id) AS inc_sub_users
			    ON inc_sub_users.incident_id = inc.id
			LEFT JOIN 
					(SELECT triaging.incident_id as incident_id, array_to_json(array_agg(usr.object_id)) as triaging_allowed_users from 
					  	${TABLES.TRIAGING_ALLOWED_USERS} as triaging
					  	JOIN ${USER_TABLES.USER} as usr
							on triaging.user_id = usr.id 
					  	GROUP BY triaging.incident_id) AS triaging
			    ON triaging.incident_id = inc.id
			LEFT JOIN 
					(SELECT msg.incident_id as incident_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as message_ready_by from 
						${TABLES.INCIDENT_MESSAGE} as msg
					  	JOIN ${TABLES.INCIDENTMESSAGE_READ_BY} as read_by
							on msg.id = read_by.incidentmessage_id
					  	JOIN ${USER_TABLES.USER} as usr
					  		on read_by.user_id = usr.id
						WHERE msg.id IN (SELECT MAX(id)
										FROM ${TABLES.INCIDENT_MESSAGE}
										GROUP BY ${TABLES.INCIDENT_MESSAGE}.incident_id)
					  	GROUP BY msg.incident_id, last_message_created_at) AS ready_by
			    ON ready_by.incident_id = inc.id
			LEFT JOIN 
					(SELECT userview.incident_id AS incident_id, array_to_json(array_agg(
							json_build_object( 
								'id', userview.id,
								'created_at', userview.created_at,
								'updated_at', userview.updated_at,
								'user_id', userview.user_id,
								'user', json_build_object('id', usr.id, 'object_id', usr.object_id),
								'viewed_at', userview.viewed_at,
								'object_id', userview.object_id,
								'incident_id', userview.incident_id
							)
						)) AS userviews
				   		FROM  ${TABLES.USER_VIEWS} as userview
							JOIN user_user as usr
								ON usr.id = userview.user_id
					   	GROUP BY userview.incident_id
				  	) as userviews
				ON userviews.incident_id = inc.id

        WHERE inc.object_id = '${id}' ${
  excludeDeleted ? "AND NOT inc.deleted" : ""
};`;

const generateJsonBuildObject = (fields, tableName, isMain = false) => {
  return `json_build_object(${fields
    .map((field) => `'${field}', ${tableName}.${field}`)
    .join(", ")} ${isMain ? "" : ")"}`;
};

/**
 * @param {Object} requiredFields - required
 * @returns {String} - A query string
  caution: Before making any changes, double-check your work. 
  		   The query could become invalid with small tweaks. 
		   So be careful!
 **/
const generateIncidentQuery = ({
  id,
  excludeDeleted = true,
  requiredFields,
}) => {
  const { mainObjectFields, specialFields, ...otherObjects } = requiredFields;

  let selects = [];
  let joins = [];
  let conditions = [];
  let isMessageReadList = false;

  let mainTable = "incident";

  if (!otherObjects["event"]) {
    otherObjects["event"] = ["id", "object_id"];
  }
  if (mainObjectFields.length === 0) mainObjectFields.push("object_id");

  selects.push(generateJsonBuildObject(mainObjectFields, mainTable, true));
  joins.push(` FROM ${TABLES.INCIDENT} as ${mainTable}`);

  Object.keys(otherObjects).forEach((obj) => {
    // For SELECT QUERY
    selects.push(
      `'${obj}', (case when ${obj}.id IS NOT NULL THEN ${generateJsonBuildObject(
        otherObjects[obj],
        obj
      )} end)`
    );

    // TABLES
    let table = obj === "event" ? EVENT_TABLES.EVENT : USER_TABLES.USER;

    if (obj === "event") {
      joins.push(`JOIN ${table} as ${obj} 
				ON ${mainTable}.${obj}_id = ${obj}.id`);

      conditions.push(`NOT ${obj}.deleted`);
    } else {
      joins.push(`LEFT JOIN ${table} as ${obj} 
				ON ${mainTable}.${obj}_id = ${obj}.id`);
    }
  });

  for (let field of specialFields) {
    if (field === "message_read_list" || field === "last_message_created_at") {
      if (isMessageReadList) continue;

      field = "message_read_list";

      selects.push(`'${field}', COALESCE(${field}.${field}, '[]'),
		  'last_message_created_at', ${field}.last_message_created_at`);

      // FOR JOINING TABLES
      joins.push(`LEFT JOIN 
					(SELECT msg.incident_id as incident_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as ${field} from 
						${TABLES.INCIDENT_MESSAGE} as msg
					  	JOIN ${TABLES.INCIDENTMESSAGE_READ_BY} as read_by
							on msg.id = read_by.incidentmessage_id
					  	JOIN ${USER_TABLES.USER} as usr
					  		on read_by.user_id = usr.id
						WHERE msg.id IN (SELECT MAX(id)
										FROM ${TABLES.INCIDENT_MESSAGE}
										GROUP BY ${TABLES.INCIDENT_MESSAGE}.incident_id)
					  	GROUP BY msg.incident_id, last_message_created_at) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);

      isMessageReadList = true;
    } else {
      selects.push(`'${field}', COALESCE(${field}.${field}, '[]')`);

      // FOR JOINING TABLES
      if (field === "incident_messages") {
        joins.push(`LEFT JOIN
					(SELECT inc.id as incident_id, array_to_json(array_agg(inc_mesg.object_id)) as ${field} from 
					  	${TABLES.INCIDENT} as inc
					  	JOIN ${TABLES.INCIDENT_MESSAGE} as inc_mesg
							ON inc.id = inc_mesg.incident_id 
					    GROUP BY inc.id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "subscribed_users") {
        joins.push(`LEFT JOIN 
					(SELECT inc_sub_users.incident_id as incident_id, array_to_json(array_agg(us.object_id)) as ${field} from 
						${TABLES.SUBSCRIBED_USERS} as inc_sub_users
					  	JOIN ${USER_TABLES.USER} as us
							on us.id = inc_sub_users.user_id
					  	GROUP BY inc_sub_users.incident_id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "triaging_allowed_users") {
        joins.push(`LEFT JOIN 
					(SELECT triaging.incident_id as incident_id, array_to_json(array_agg(usr.object_id)) as ${field} from 
					  	${TABLES.TRIAGING_ALLOWED_USERS} as triaging
					  	JOIN ${USER_TABLES.USER} as usr
							on triaging.user_id = usr.id 
					  	GROUP BY triaging.incident_id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "user_views") {
        joins.push(`LEFT JOIN 
					(SELECT userview.incident_id AS incident_id, array_to_json(array_agg(
							json_build_object( 
								'id', userview.id,
								'created_at', userview.created_at,
								'updated_at', userview.updated_at,
								'user_id', userview.user_id,
								'user', json_build_object('id', usr.id, 'object_id', usr.object_id),
								'viewed_at', userview.viewed_at,
								'object_id', userview.object_id,
								'incident_id', userview.incident_id
							)
						)) AS ${field}
				   		FROM  ${TABLES.USER_VIEWS} as userview
							JOIN user_user as usr
								ON usr.id = userview.user_id
					   	GROUP BY userview.incident_id
				  	) as ${field}
				ON ${field}.incident_id = ${mainTable}.id`);
      }
    }
  }

  if (typeof id === "number") conditions.push(`${mainTable}.id = ${id}`);
  else conditions.push(`${mainTable}.object_id = '${id}'`);

  conditions.push(`${excludeDeleted ? `NOT ${mainTable}.deleted` : "TRUE"}`);

  const query =
    "SELECT " +
    selects.join(", ") +
    ") as data" +
    joins.join(" ") +
    " WHERE " +
    conditions.join(" AND ");

  console.log("The query:::", query);

  return query;
};

/**
 * @param {Object} requiredFields - required
 * @returns {String} - A query string
  caution: Before making any changes, double-check your work. 
  		   The query could become invalid with small tweaks. 
		   So be careful!
 **/
const generateIncidentsQuery = ({
  limit,
  offset,
  sort,
  eventId = null,
  isClosed = false,
  requiredFields,
}) => {
  const { mainObjectFields, specialFields, ...otherObjects } = requiredFields;

  let selects = [];
  let joins = [];
  let conditions = [];
  let isMessageReadList = false;

  let mainTable = "incident";

  if (!otherObjects["event"]) {
    otherObjects["event"] = ["id", "object_id"];
  }
  if (mainObjectFields.length === 0) mainObjectFields.push("object_id");

  selects.push(generateJsonBuildObject(mainObjectFields, mainTable, true));
  joins.push(` FROM ${TABLES.INCIDENT} as ${mainTable}`);

  Object.keys(otherObjects).forEach((obj) => {
    // For SELECT QUERY
    selects.push(
      `'${obj}', (case when ${obj}.id IS NOT NULL THEN ${generateJsonBuildObject(
        otherObjects[obj],
        obj
      )} end)`
    );

    // TABLES
    let table = obj === "event" ? EVENT_TABLES.EVENT : USER_TABLES.USER;

    if (obj === "event") {
      joins.push(`JOIN ${table} as ${obj} 
				ON ${mainTable}.${obj}_id = ${obj}.id`);

      conditions.push(`NOT ${obj}.deleted`);
      if (eventId) conditions.push(`${obj}.object_id = '${eventId}'`);
    } else {
      joins.push(`LEFT JOIN ${table} as ${obj} 
				ON ${mainTable}.${obj}_id = ${obj}.id`);
    }
  });

  for (let field of specialFields) {
    if (field === "message_read_list" || field === "last_message_created_at") {
      if (isMessageReadList) continue;

      field = "message_read_list";

      selects.push(`'${field}', COALESCE(${field}.${field}, '[]'),
		  'last_message_created_at', ${field}.last_message_created_at`);

      // FOR JOINING TABLES
      joins.push(`LEFT JOIN 
					(SELECT msg.incident_id as incident_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as ${field} from 
						${TABLES.INCIDENT_MESSAGE} as msg
					  	JOIN ${TABLES.INCIDENTMESSAGE_READ_BY} as read_by
							on msg.id = read_by.incidentmessage_id
					  	JOIN ${USER_TABLES.USER} as usr
					  		on read_by.user_id = usr.id
						WHERE msg.id IN (SELECT MAX(id)
										FROM ${TABLES.INCIDENT_MESSAGE}
										GROUP BY ${TABLES.INCIDENT_MESSAGE}.incident_id)
					  	GROUP BY msg.incident_id, last_message_created_at) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);

      isMessageReadList = true;
    } else {
      selects.push(`'${field}', COALESCE(${field}.${field}, '[]')`);

      // FOR JOINING TABLES
      if (field === "incident_messages") {
        joins.push(`LEFT JOIN 
					(SELECT inc.id as incident_id, array_to_json(array_agg(inc_mesg.object_id)) as ${field} from 
					  	${TABLES.INCIDENT} as inc
					  	JOIN ${TABLES.INCIDENT_MESSAGE} as inc_mesg
							ON inc.id = inc_mesg.incident_id 
					    GROUP BY inc.id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "subscribed_users") {
        joins.push(`LEFT JOIN 
					(SELECT inc_sub_users.incident_id as incident_id, array_to_json(array_agg(us.object_id)) as ${field} from 
						${TABLES.SUBSCRIBED_USERS} as inc_sub_users
					  	JOIN ${USER_TABLES.USER} as us
							on us.id = inc_sub_users.user_id
					  	GROUP BY inc_sub_users.incident_id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "triaging_allowed_users") {
        joins.push(`LEFT JOIN 
					(SELECT triaging.incident_id as incident_id, array_to_json(array_agg(usr.object_id)) as ${field} from 
					  	${TABLES.TRIAGING_ALLOWED_USERS} as triaging
					  	JOIN ${USER_TABLES.USER} as usr
							on triaging.user_id = usr.id 
					  	GROUP BY triaging.incident_id) AS ${field}
			    ON ${field}.incident_id = ${mainTable}.id`);
      }

      if (field === "user_views") {
        joins.push(`LEFT JOIN 
					(SELECT userview.incident_id AS incident_id, array_to_json(array_agg(
							json_build_object( 
								'id', userview.id,
								'created_at', userview.created_at,
								'updated_at', userview.updated_at,
								'user_id', userview.user_id,
								'user', json_build_object('id', usr.id, 'object_id', usr.object_id),
								'viewed_at', userview.viewed_at,
								'object_id', userview.object_id,
								'incident_id', userview.incident_id
							)
						)) AS ${field}
				   		FROM  ${TABLES.USER_VIEWS} as userview
							JOIN user_user as usr
								ON usr.id = userview.user_id
					   	GROUP BY userview.incident_id
				  	) as ${field}
				ON ${field}.incident_id = ${mainTable}.id`);
      }
    }
  }

  conditions.push(
    `NOT ${mainTable}.deleted AND ${
      isClosed ? "" : "NOT"
    } ${mainTable}.archived`
  );

  const query =
    `SELECT array_to_json(array_agg(${mainTable}.${mainTable})) as data FROM (` +
    "SELECT " +
    selects.join(", ") +
    `) as ${mainTable}` +
    joins.join(" ") +
    " WHERE " +
    conditions.join(" AND ") +
    ` ORDER BY ${mainTable}.created_at ${sort} OFFSET ${offset} LIMIT ${limit} ) as ${mainTable};`;

  console.log("The query:::", query);

  return query;
};

const getIncidentsQuery = ({
  limit,
  offset,
  sort,
  eventId = null,
  isClosed = false,
}) => `
    SELECT 
        row_to_json(inc.*) as incident,
        row_to_json(ev.*) as event,
        row_to_json(arby.*) as archived_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(rby.*) as reported_by,
        row_to_json(resby.*) as resolved_by,
        row_to_json(cby.*) as created_by,
        row_to_json(uby.*) as updated_by,
        COALESCE(incident_messages.incident_messages, '[]') as incident_messages,
        COALESCE(inc_sub_users.subscribed_users, '[]') as subscribed_users,
		COALESCE(triaging.triaging_allowed_users, '[]') as triaging_allowed_users,
		COALESCE(ready_by.message_ready_by, '[]') as message_read_list,
		ready_by.last_message_created_at as last_message_created_at,
		COALESCE(userviews.userviews, '[]') as user_views
		FROM ${TABLES.INCIDENT} as inc
			LEFT JOIN (
					SELECT * FROM ${EVENT_TABLES.EVENT} WHERE NOT event_event.deleted
				) as ev
				ON inc.event_id = ev.id
			LEFT JOIN ${USER_TABLES.USER} as arby 
				ON inc.archived_by_id = arby.id
		    LEFT JOIN ${USER_TABLES.USER} as dby
				ON inc.deleted_by_id = dby.id
			LEFT JOIN ${USER_TABLES.USER} as rby
				ON inc.reported_by_id = rby.id
			LEFT JOIN ${USER_TABLES.USER} as resby
				ON inc.resolved_by_id = resby.id
			LEFT JOIN ${USER_TABLES.USER} as cby
				ON inc.created_by_id = cby.id
			LEFT JOIN ${USER_TABLES.USER} as uby
				ON inc.updated_by_id = uby.id
            LEFT JOIN 
					(SELECT inc.id as incident_id, array_to_json(array_agg(inc_mesg.object_id)) as incident_messages from 
					  	${TABLES.INCIDENT} as inc
					  	JOIN ${TABLES.INCIDENT_MESSAGE} as inc_mesg
							ON inc.id = inc_mesg.incident_id 
					    GROUP BY inc.id) AS incident_messages
			    ON incident_messages.incident_id = inc.id
            LEFT JOIN 
					(SELECT inc_sub_users.incident_id as incident_id, array_to_json(array_agg(us.object_id)) as subscribed_users from 
						${TABLES.SUBSCRIBED_USERS} as inc_sub_users
					  	JOIN ${USER_TABLES.USER} as us
							on us.id = inc_sub_users.user_id
					  	GROUP BY inc_sub_users.incident_id) AS inc_sub_users
			    ON inc_sub_users.incident_id = inc.id
			LEFT JOIN 
					(SELECT triaging.incident_id as incident_id, array_to_json(array_agg(usr.object_id)) as triaging_allowed_users from 
					  	${TABLES.TRIAGING_ALLOWED_USERS} as triaging
					  	JOIN ${USER_TABLES.USER} as usr
							on triaging.user_id = usr.id 
					  	GROUP BY triaging.incident_id) AS triaging
			    ON triaging.incident_id = inc.id
			LEFT JOIN 
					(SELECT msg.incident_id as incident_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as message_ready_by from 
						${TABLES.INCIDENT_MESSAGE} as msg
					  	JOIN ${TABLES.INCIDENTMESSAGE_READ_BY} as read_by
							on msg.id = read_by.incidentmessage_id
					  	JOIN ${USER_TABLES.USER} as usr
					  		on read_by.user_id = usr.id
						WHERE msg.id IN (SELECT MAX(id)
										FROM ${TABLES.INCIDENT_MESSAGE}
										GROUP BY ${TABLES.INCIDENT_MESSAGE}.incident_id)
					  	GROUP BY msg.incident_id, last_message_created_at) AS ready_by
			    ON ready_by.incident_id = inc.id
			LEFT JOIN 
					(SELECT userview.incident_id AS incident_id, array_to_json(array_agg(
							json_build_object( 
								'id', userview.id,
								'created_at', userview.created_at,
								'updated_at', userview.updated_at,
								'user_id', userview.user_id,
								'user', usr,
								'viewed_at', userview.viewed_at,
								'object_id', userview.object_id,
								'incident_id', userview.incident_id
							)
						)) AS userviews
				   		FROM  ${TABLES.USER_VIEWS} as userview
							JOIN user_user as usr
								ON usr.id = userview.user_id
					   	GROUP BY userview.incident_id
				  	) as userviews
				ON userviews.incident_id = inc.id
			
        WHERE NOT inc.deleted AND ${isClosed ? "" : "NOT"} inc.archived ${
  eventId ? `AND ev.object_id = '${eventId}'` : ""
}
        ORDER BY inc.created_at ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getIncidentViewsQuery = ({ id, sort, offset, limit }) => `
	SELECT 
		row_to_json(inc_view.*) as incident_userview, 
		row_to_json(usr.*) as user_obj 
	FROM ${TABLES.USER_VIEWS} as inc_view
	JOIN ${TABLES.INCIDENT} as inc
		on inc.id = inc_view.incident_id
	JOIN user_user as usr
		on usr.id = inc_view.user_id 
	WHERE NOT inc.deleted AND inc.object_id = '${id}'
	ORDER BY inc_view.created_at ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getEventIncidentMessagesQuery = ({ eventId, limit, offset, sort }) => `
	SELECT 
		row_to_json(incidentmessage.*) as incidentmessage,
		row_to_json(inc.*) as incident,
		row_to_json(usr.*) as user
	FROM incident_incidentmessage as incidentmessage
	LEFT JOIN incident_incident as inc
		on inc.id = incidentmessage.incident_id
	LEFT JOIN event_event as evt
		ON evt.id = inc.event_id
	LEFT JOIN user_user as usr
		on usr.id = incidentmessage.user_id

	WHERE NOT inc.deleted AND evt.object_id = '${eventId}'
	ORDER BY incidentmessage.created_at ${sort} OFFSET ${offset} LIMIT ${limit}`;

const getIncidentMessagesQuery = ({ incidentId, limit, offset, sort }) => `
	SELECT 
		row_to_json(incidentmessage.*) as incidentmessage,
		row_to_json(inc.*) as incident,
		row_to_json(usr.*) as user,
		row_to_json(cby.*) as created_by,
        row_to_json(uby.*) as updated_by 
	FROM ${TABLES.INCIDENT_MESSAGE} as incidentmessage
	LEFT JOIN ${TABLES.INCIDENT} as inc
		on inc.id = incidentmessage.incident_id
	LEFT JOIN ${USER_TABLES.USER} as usr
		on usr.id = incidentmessage.user_id
	LEFT JOIN ${USER_TABLES.USER} as cby
		ON incidentmessage.created_by_id = cby.id
	LEFT JOIN ${USER_TABLES.USER} as uby
		ON incidentmessage.updated_by_id = uby.id
	WHERE NOT inc.deleted AND inc.object_id = '${incidentId}'
	ORDER BY incidentmessage.created_at ${sort} OFFSET ${offset} LIMIT ${limit}`;

const getIncidentMessageQuery = (object_id) => `
	SELECT 
		row_to_json(incidentmessage.*) as incidentmessage,
		row_to_json(inc.*) as incident,
		row_to_json(usr.*) as user,
		row_to_json(cby.*) as created_by,
        row_to_json(uby.*) as updated_by,
		row_to_json(ev.*) as event
	FROM ${TABLES.INCIDENT_MESSAGE} as incidentmessage
	LEFT JOIN ${TABLES.INCIDENT} as inc
		on inc.id = incidentmessage.incident_id
	LEFT JOIN ${USER_TABLES.USER} as usr
		on usr.id = incidentmessage.user_id
	LEFT JOIN ${USER_TABLES.USER} as cby
		ON incidentmessage.created_by_id = cby.id
	LEFT JOIN ${USER_TABLES.USER} as uby
		ON incidentmessage.updated_by_id = uby.id
	LEFT JOIN ${EVENT_TABLES.EVENT} as ev
		ON inc.event_id = ev.id
	WHERE incidentmessage.object_id = '${object_id}'`;

module.exports = {
  getIncidentQuery,
  getIncidentsQuery,
  getIncidentViewsQuery,
  getEventIncidentMessagesQuery,
  getIncidentMessagesQuery,
  getIncidentMessageQuery,
  generateIncidentQuery,
  generateIncidentsQuery,
};
