/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {


    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }

    // Initialize the view
    async function initializeView(tempalteId) {

        try {
            templateId = templateId || "org.santedb.emr.patient";
            var _entityTemplate = await SanteDB.application.getTemplateContentAsync(templateId);
            $timeout(() => $scope.entity = angular.copy(_entityTemplate));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Check for duplicates
    async function checkDuplicates(patient) {
        try {
            // TODO: Invoke the $match operation
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resetView = async function () {
        await initializeView(templateId);
    }

    initializeView(templateId);

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }

    // unbind the nav away
    $scope.$on("$destroy", function (s) {
        window.onbeforeunload = null;
    })
}])
    // CONTROLLER -> Generic functions for registration widgets (note: should not $watch or initialize data)
    .controller("EmrPatientRegisterWidgetController", ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

        $scope.ageToDate = ageToDate;
        $scope.dateToAge = dateToAge;

        async function lookupRelative(relativeType, identifierList) {
            try {

                var filter = {
                    _includeTotal: true,
                    _count: 1
                };

                Object.keys(identifierList).forEach(o => {
                    var identifiers = identifierList[o].filter(id => id.value && id.value != "");
                    if (identifiers.length > 0) {
                        filter[`identifier[${o}].value`] = identifiers.map(o => o.value);
                    }
                });

                if (Object.keys(filter).length > 2) {
                    var matches = await SanteDB.resources.person.findAsync(filter, "min");
                    if (matches.totalResults == 1) {
                        $scope.scopedObject.relationship[relativeType][0] = new Person(matches.resource[0]); // Copy the information from the other relative
                    }
                    else if (matches.totalResults > 1) {
                        toastr.warn(SanteDB.locale.getString("ui.emr.patient.register.relative.multipleMatches", { relativeType: relativeType }));
                    }
                }
            }
            catch (e) {
                toastr.warn(SanteDB.locale.getString("ui.emr.patient.register.relative.errorSearching", { error: e.message }));
            }
        }

        switch ($scope.panel.name) {
            case "org.santedb.emr.widget.patient.register.mother":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.Mother[0].identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("Mother", $scope.scopedObject.relationship.Mother[0].identifier);
                    }
                });

                break;
            case "org.santedb.emr.widget.patient.register.relative":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.NextOfKin[0].identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("NextOfKin", $scope.scopedObject.relationship.NextOfKin[0].identifier);
                    }
                });
                break;
        }

}])
