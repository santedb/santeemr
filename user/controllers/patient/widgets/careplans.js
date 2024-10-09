/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', function ($scope, $timeout, $rootScope) {


    async function initializeView(patientId) {
        try {
            var carePathways = await SanteDB.resources.patient.invokeOperationAsync(patientId, "carepath-eligibilty");
            var enrolledCarePathways = await SanteDB.resources.patient.findAssociatedAsync(patientId, "carepaths");

            carePathways.forEach(cp => {
                if (enrolledCarePathways.resource && enrolledCarePathways.resource.find(o => o.id == cp.id || o.pathway == cp.id)) {
                    cp._enrolled = true;
                }
            })
            $timeout(() => {
                $scope.carePathways = carePathways;
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    async function fetchNextEncounters(path, monthLimit, limit) {
        try {
            if (path.encounters) {
                return;
            }
            else {

                var filter = {
                    moodConcept: ActMoodKeys.Propose,
                    'relationship[HasComponent].source@CarePlan.pathway': path.id,
                    'participation[RecordTarget].player': $scope.scopedObject.id,
                    'statusConcept': StatusKeys.New,
                    'actTime': [],
                    _orderBy: 'actTime:asc',
                    _includeTotal: false,
                    _count: limit
                };

                if (monthLimit) {
                    for (var mo = -monthLimit; mo <= monthLimit; mo++) {
                        filter.actTime.push(`~${moment().add(mo, 'month').format('YYYY-MM')}`);
                    }
                }

                var encounters = await SanteDB.resources.patientEncounter.findAsync(filter, "full");

                filter._count = 0;
                filter._includeTotal = true;
                delete filter.actTime;
                var count = await SanteDB.resources.patientEncounter.findAsync(filter);

                $timeout(() => {
                    path.encounters = encounters.resource || [];
                    path._totalEncounters = count.totalResults;
                });
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }


    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;

    $scope.fetchNextEncounters = fetchNextEncounters;
    initializeView($scope.scopedObject.id);
}]);
