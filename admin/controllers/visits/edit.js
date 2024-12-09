/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrEditVisitTypesController', [ "$scope", "$rootScope", "$timeout", "$state", "$stateParams", function($scope, $rootScope, $timeout, $state, $stateParams) {

    async function initializeView(id) {
        try {
            var visitType = {
                concept: new Concept(), 
                flowStates: []
            };

            if(id) {
                visitType.concept = id;
                visitType.conceptModel = await SanteDB.resources.concept.getAsync(id, "full");
                var flows = await SanteDB.resources.conceptRelationship.findAsync({ targetConcept: id, relationshipType: ConceptRelationshipTypeKeys.MemberOf }, "reverseRelationship");
                visitType.flowStates = (flows.resource || []).map(c=>c.sourceModel);
            }

            $timeout(() => $scope.visitType = visitType);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);
}]);

