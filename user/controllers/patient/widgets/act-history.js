
// Template icons
angular.module('santedb').controller('EmrActHistoryWidgetController', ['$scope', '$rootScope', '$state', "$timeout", function ($scope, $rootScope, $state, $timeout) {


    var _templateIcons = {};

    // Initialize the view
    async function initialize() {
        try {
            
            if(Object.keys(_templateIcons).length == 0) {
                var templates = await SanteDB.application.getTemplateDefinitionsAsync();
                templates.forEach(function(tpl) {
                    _templateIcons[tpl.mnemonic] = tpl.icon; 
                });
                
                $timeout(() => $scope.templateIcon = _templateIcons);
            }
        }
        catch(e) {
            console.warn("Cannot fetch template icons", e);
        }
    }

    initialize();

    $scope.resolveSummary = function(templateId) {

        var templateValue = SanteDB.application.resolveTemplateSummary(templateId);
        if(templateValue == null) {
            return  "/org.santedb.uicore/partials/act/noTemplate.html"
        }
        return templateValue;
    }

    // Watch for scoped object
    $scope.$watch("scopedObject", async function(n, o) {
        if(n && n.id) {
            try {
                var history = [];
                var offset = 0;

                // Lookup MDM links
                var er = await SanteDB.resources.entityRelationship.findAsync({ 
                    "relationshipType": "97730a52-7e30-4dcd-94cd-fd532d111578", // MDM
                    "target" : n.id // Where this is the target
                }, "reverseRelationship");
                var keys = [ n.id ];
                if(er.resource) {
                    er.resource.map(function(e) { return e.holder; }).forEach(function(e) { keys.push(e); });
                }

                do {
                    var results = await SanteDB.resources.patientEncounter.findAsync(
                        {
                            "participation[RecordTarget].player" : keys,
                            "moodConcept" : ActMoodKeys.Eventoccurrence,
                            _orderBy: 'actTime:desc',
                            _offset: offset,
                            _count: 10,
                            _includeTotal: false
                        },
                        "full"
                    );
                    offset += results.count;
                    if(results.resource)
                    {
                        results.resource.forEach(r => history.push(r));
                    }
                    $timeout(() => $scope.history = history);
                } while(results.resource)
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    })
}]);