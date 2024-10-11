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

    async function unenroll(pathway, idx) {
        if (confirm(SanteDB.locale.getString("ui.emr.patient.carePaths.unenroll.confirm", { pathway: pathway.name }))) {
            try {
                SanteDB.display.buttonWait(`#btnUnenroll${idx}`, true);

                var carePlan = await SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-unenroll", {
                    pathway: pathway.id
                });
                $(`#carePathway${idx}`).collapse("hide");
                $timeout(() =>{
                    pathway._enrolled = false;
                    pathway.encounters = null;
                });
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.unenroll.success"));
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#btnUnenroll${idx}`, false);
            }
        }
    }
    async function enroll(pathway, idx) {

        if (confirm(SanteDB.locale.getString("ui.emr.patient.carePaths.enroll.confirm", { pathway: pathway.name }))) {
            try {
                SanteDB.display.buttonWait(`#btnEnroll${idx}`, true);

                var carePlan = await SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-enroll", {
                    pathway: pathway.id
                });
                $(`#carePathway${idx}`).collapse("show");
                await fetchNextEncounters(pathway, 1, 3);
                $timeout(() => pathway._enrolled = true);
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.enroll.success"));
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#btnEnroll${idx}`, false);
            }
        }
    }

    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.enroll = enroll;
    $scope.unenroll = unenroll;

    $scope.fetchNextEncounters = fetchNextEncounters;
    initializeView($scope.scopedObject.id);
}]);
