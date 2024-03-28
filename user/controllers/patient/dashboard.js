/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientDashboardController', ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {

    let _renderAge = function(patient){
        if (patient && patient.dateOfBirth){
            let curr = moment();
            let diff = curr.diff(patient.dateOfBirth, 'days');

            if (diff < 45){
                return `${diff} ${SanteDB.locale.getString('ui.model.patient.age.suffix.daysOld')}`;
            }
            diff = curr.diff(patient.dateOfBirth, 'months');
            if (diff < 18){
                return `${diff} ${SanteDB.locale.getString('ui.model.patient.age.suffix.monthsOld')}`;
            }
            diff = curr.diff(patient.dateOfBirth, 'years');
            return `${diff} ${SanteDB.locale.getString('ui.model.patient.age.suffix.yearsOld')}`;            
        }
        else{
            return "N/A";
        }
    }

    let _renderNameAndGender = function(patient){

        if (patient){
            let genderIcon = "fa-restroom";

            if (patient.genderConcept === '094941e9-a3db-48b5-862c-bc289bd7f86c'){
                genderIcon = "fa-female";
            }
            else if (patient.genderConcept === 'f4e3a6bb-612e-46b2-9f77-ff844d971198'){
                genderIcon = 'fa-male';
            }
            return `<i class="fas ${genderIcon}"></i> <strong>${SanteDB.display.renderEntityName(patient.name, "OfficialRecord")}</strong>`;
        }
        else{
            return "N/A";
        }
    }

    async function initializeView() {

        try {
            $timeout(() => {
                $scope.dashboard = {
                    renderAge: _renderAge,
                    renderName: _renderNameAndGender,
                    renderAddress: function(patient){
                        console.log(patient);

                        return SanteDB.display.renderEntityAddress(patient.address, 'HomeAddress')
                    },
                    recentPatients: { 
                        //modifiedOn: ":(age)<PT4H",
                        _orderBy: 'creationTime:desc' ,
                        _upstream: true,
                    }
                };
            })
        }
        catch(err) { $rootScope.errorHandler(err); }
    }

    initializeView();

    /*
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
    */
}]);