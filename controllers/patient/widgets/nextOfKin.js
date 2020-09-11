/// <reference path="../../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientNextOfKinController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", function ($scope, $rootScope, $state, $templateCache, $interval) {

    $scope.synchronizeAge = synchronizeAge;
    $scope.tabHasError = tabHasError;
    $scope.copyFields = copyFields;

    // Copy fields
    function copyFields(relationshipTarget) {
        if($scope.scopedObject.relationship &&
            $scope.scopedObject.relationship[relationshipTarget] &&
            $scope.scopedObject.relationship[relationshipTarget].targetModel)
            {
                $scope.scopedObject.relationship[relationshipTarget].targetModel.address = angular.copy($scope.scopedObject.address);
            }
    }
    // Determine if tab has error
    function tabHasError(tabInputPrefix) {
        if(!$scope.panel.editForm) return false;

        return Object.keys($scope.panel.editForm.$error).findIndex(function(errorKey) {
            var errorArray = $scope.panel.editForm.$error[errorKey];
            return errorArray.findIndex(function(error) { return error.$name.indexOf(tabInputPrefix) == 0; }) != -1;
        }) != -1;
    }

    // Synchronize ages of object
    function synchronizeAge(modelObject, fromDate) {

        if (modelObject.dateOfBirth && fromDate)
            modelObject.age = moment().diff(modelObject.dateOfBirth, 'years', false);
        else {
            modelObject.dateOfBirth = moment().subtract({ years: modelObject.age }).toDate();
            modelObject.dateOfBirthPrecision = 1;
        }
    }

    // Next of Kin Controller
    async function initializeView() {
        try {
            $scope.familyMemberRelationships = (await SanteDB.resources.concept.findAsync({"conceptSet.mnemonic" : "FamilyMember", "mnemonic" : Object.keys($scope.scopedObject.relationship)})).resource;

        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }
    initializeView().then(function() { $scope.$apply(); });
}]);
