# Autorouter
The autorouter provides intelligent routing for connections on box diagrams.

## API
+ clear
+ setBox(id, rect)  // To create/resize/move
    + setBox('myBox', {x1, x2, y1, y2})  // To remove   Should I do it this way??? 
    + setBox(id, null)  // To remove   Should I do it this way??? 

    + return the new box or null (if removed)

# + setDependentBox(parentId, childId)

+ setPort(boxId, portId, area)
    + setPort('box-10', 'north', {x1, y1, x2, y2})  // Create/update
    + setPort('box-10', 'north', null)  // removal

    + return the port object


+ setPath(pathId, srcBoxId, dstBoxId)  // create/update
    + setPath(pathId, null)  // remove

    + return a path object: {id: pathId, points: [], __raw__: ARPath}

+ setCustomRouting(pathId, [[x, y], [x, y], ...])  // custom path
    + setCustomRouting(pathId, null)  // autorouted


+ routeSync
+ routeAsync(options)

The above works great if the user is on the same thread. However, if it is in a web worker, we will need to be able to request these objects. To support this case, I will add the following methods:
+ box(id)  // Return copies of the wrappers
    + {id: id, x: x, width: width, y: y, height: height}, 
+ port(boxId, id)
    + {id: id, x: x, width: width, y: y, height: height}, 
+ path(id)
    + {id: id, points: [[x, y], [x, y], ...]}, 

+ boxes()
    + [id, id, id]
+ ports(boxId)
    + [id, id, id]
+ paths()
    + [id, id, id]
