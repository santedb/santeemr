
// Template icons
var _templateIcons = {};

angular.module('santedb').controller('EmrActHistoryWidgetController', ['$scope', '$rootScope', '$state', function ($scope, $rootScope, $state) {

    $scope.templateIcon = _templateIcons;

    // Initialize the view
    async function initialize() {
        try {
            if(Object.keys(_templateIcons).length == 0) {
                var templates = await SanteDB.application.getTemplateDefinitionsAsync();
                templates.forEach(function(tpl) {
                    _templateIcons[tpl.mnemonic] = tpl.icon; 
                });
                try {
                    $scope.$apply();
                }
                catch(e){}

            }
        }
        catch(e) {
            console.warn("Cannot fet template icons", e);
        }
    }

    initialize();

    /**
     * @summary Actually load an object from API
     * @param {*} type The type of object
     * @param {*} key The key of the object to load
     */
    async function loadObject(type, key) {
        try {
            return await SanteDB.resources[type.toCamelCase()].getAsync(key);
        }
        catch(e) {

        }
    }

    /**
     * @summary Ensure the specified player object 
     * @param {*} participation The ActParticipation to load player for
     */
    $scope.loadPlayer = function(participation) {
        if(participation.playerModel) return; // already loaded
        loadObject("Entity", participation.player).then(function(e) { 
            participation.playerModel = e;
        }).catch(console.warn);
    }

    // Watch for scoped object
    $scope.$watch("scopedObject", async function(n, o) {
        if(n && n.id) {
            try {
                $scope.history = [];
                var offset = 0, count = 1;

                // Lookup MDM links
                var er = await SanteDB.resources.entityRelationship.findAsync({ 
                    "relationshipType": "97730a52-7e30-4dcd-94cd-fd532d111578", // MDM
                    "target" : n.id // Where this is the target
                }, "reverseRelationship");
                var keys = [ n.id ];
                if(er.resource)
                    er.resource.map(function(e) { return e.holder; }).forEach(function(e) { keys.push(e); });

                while(offset < count) {
                    var results = await SanteDB.resources.act.findAsync(
                        {
                            "participation[RecordTarget].player" : keys,
                            _offset: offset,
                            _count: 10
                        },
                        "full"
                    );
                    count = results.totalResults;
                    offset += results.count;
                    if(results.resource)
                        await Promise.all(results.resource.map(async function(r) { 
                            $scope.history.push(r); 
                        }));

                    // Apply the reuslt
                    try {
                        $scope.$applyAsync();
                    } catch(e) {}
                }

               
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    })
}]);