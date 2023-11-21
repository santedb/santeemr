/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientIndexController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", function ($scope, $rootScope, $state, $templateCache, $interval) {

    // Render demographic information
    $scope.renderSummary = renderPatientSummary;
    
    // Render address
    $scope.renderAddress = function (patient) {

        var retVal = "";
        if (patient.address)
            Object.keys(patient.address).forEach(function (n) {
                retVal += `${SanteDB.display.renderEntityAddress(patient.address[n])},`;
            });
        else
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }

    // Render the names
    $scope.renderName = function (patient) {

        var retVal = "";
        if (patient.name)
            Object.keys(patient.name).forEach(function (n) {
                retVal += `${SanteDB.display.renderEntityName(patient.name[n])},`;
            });
        else
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }

    // Render DOB
    $scope.renderDob = function (patient) {
        if (patient.dateOfBirth)
            return SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision);
        else
            return "N/A";
    }

    // Render the patient's gender
    $scope.renderGender = function (patient) {
        var retVal = "";
        if(!patient.genderConcept)
            retVal += '<i class="fas fa-question-circle"></i> ';
        else 
        switch (patient.genderConcept) {
            case "f4e3a6bb-612e-46b2-9f77-ff844d971198":
                retVal += '<i class="fas fa-male"></i> ';
                break;
            case "094941e9-a3db-48b5-862c-bc289bd7f86c":
                retVal += '<i class="fas fa-female"></i> ';
                break;
            default:
                retVal += '<i class="fas fa-question-circle"></i> ';
        }

        if (patient.genderConceptModel && patient.genderConceptModel.mnemonic) {
            retVal += SanteDB.display.renderConcept(patient.genderConceptModel);
        }
        return retVal;
    }

    // Render identifiers
    $scope.renderIdentifier = function (patient) {

        var preferred = null;
        if($rootScope.system.config)
            preferred = $rootScope.system.config.application.setting['aa.preferred'];

        var retVal = "";
        if (patient.identifier) {
            Object.keys(patient.identifier).forEach(function (id) {
                if( retVal == "" && (preferred && id == preferred || !preferred))
                    retVal += `${patient.identifier[id].value} <span class="badge badge-dark">${patient.identifier[id].domainModel ? patient.identifier[id].domainModel.name : id}</span> ,`;
            });
        }

        else retVal += "N/A ";
        return retVal.substring(0, retVal.length - 1);
    }

}]);