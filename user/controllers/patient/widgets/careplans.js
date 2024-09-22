/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', function ($scope, $timeout, $rootScope) {


    async function initializeView(patientId) {
        try {
            await SanteDB.application.getTemplateDefinitionsAsync();
            var carePathways = await SanteDB.resources.patient.invokeOperationAsync(patientId, "carepath-eligibilty");
            var enrolledCarePathways = await SanteDB.resources.patient.findAssociatedAsync(patientId, "carepaths");

            carePathways.forEach(cp => {
                if(enrolledCarePathways.resource && enrolledCarePathways.resource.find(o=>o.id == cp.id || o.pathway == cp.id)) {
                    cp._enrolled = true;
                }
            })
            $timeout(() => {
                $scope.carePathways = carePathways;
            });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    async function fetchNextEncounters(path) {
        try {
            if(path.encounters) { 
                return;
            }
            else {
                var encounters = await SanteDB.resources.patientEncounter.findAsync({ 
                    moodConcept: ActMoodKeys.Propose, 
                    'relationship[HasComponent].source@CarePlan.pathway': path.id,
                    'participation[RecordTarget].player' : $scope.scopedObject.id,
                    'actTime' : `>${moment().add(-7,'days').format('YYYY-MM-DD')}`,
                    _orderBy: 'actTime:asc',
                    _includeTotal: false,
                    _count: 2 
                }, "full");
                $timeout(() => path.encounters = encounters.resource);
            }
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resolveTemplateIcon = function(templateId) {
        var template = SanteDB.application.getTemplateMetadata(templateId);
        if(template) {
            return template.icon;
        }
        else {
            return "fa-notes-medical";
        }
    }

    $scope.resolveSummaryTemplate = function(templateId) {
        var templateValue = SanteDB.application.resolveTemplateSummary(templateId);
        if(templateValue == null) {
            return  "/org.santedb.uicore/partials/act/noTemplate.html"
        }
        return templateValue;
    }
    
    $scope.fetchNextEncounters = fetchNextEncounters;
    initializeView($scope.scopedObject.id);
}]);
