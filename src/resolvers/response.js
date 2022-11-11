const prepareObject = (combinedObj, main_object_name) => {
  let mainObj = combinedObj[main_object_name];

  for (let key in combinedObj) {
    if (key === main_object_name) continue;

    let value = combinedObj[key];

    if (
      typeof value === "string" &&
      value[0] === "[" &&
      value[value.length - 1] === "]"
    ) {
      try {
        value = JSON.parse(value);
      } catch (error) {
        value = value.slice(1, -1).split(",");
      }
    }

    if (Array.isArray(value)) {
      if (value.length === 1 && value[0] === null) value = [];
    }

    mainObj[key] = value;
  }

  return mainObj;
};

module.exports = ({ result, main_object_name, others }) => {
  if (Array.isArray(result)) {
    let nextOffset =
      others.limit === result.length
        ? (parseInt(others.offset) || 0) + result.length + 1
        : null;

    if (!main_object_name) {
      return {
        items: result,
        count: result.length,
        nextOffset: nextOffset,
      };
    }

    let items = [];
    for (let item of result) {
      let preparedObj = prepareObject(item, main_object_name);
      items.push(preparedObj);
    }
    console.log(`Final Result:: ${main_object_name} :::`, items);

    return {
      items: items,
      count: items.length,
      nextOffset: nextOffset,
    };
  } else {
    if (!result || !main_object_name) {
      return {
        item: result,
      };
    }

    let preparedObj = prepareObject(result, main_object_name);
    console.log(`Final Result:: ${main_object_name} :::`, preparedObj);

    return {
      item: preparedObj,
    };
  }
};
