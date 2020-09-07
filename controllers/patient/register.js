/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", function ($scope, $rootScope, $state, $transitions, $interval) {

    // Assign the scope functions
    $scope.cancelEdit = cancelEdit;
    $scope.registerPatient = registerPatient;
    $scope.checkDuplicates = async function(page) {
        $scope.duplicates = await checkDuplicates(page);
        $scope.$apply();
    }


    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
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

    // Initialize the view
    async function initializeView() {

        try {
            $scope.templates = await SanteDB.application.getTemplateDefinitionsAsync({ "scope": "org.santedb.patient" });
            $scope.patient = await SanteDB.application.getTemplateContentAsync(templateId);
            // Watchers
            $scope.$watch("patient.dateOfBirth", function (n, o) {
                if (n && n != o)
                    synchronizeAge($scope.patient, true);
            });
            $scope.$watch("patient.age", function (n, o) {
                if (n && n != o)
                    synchronizeAge($scope.patient);
            });

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }
    initializeView().then(function () { $scope.$apply(); });

    // Check for duplicates
    async function checkDuplicates(page) {
        try {

            page = page || 0;
            // First, are there duplicates that need to be considered? 
            // We will search by an identifier if possible
            var duplicateQuery = {};
            if ($scope.patient.identifier)
                Object.keys($scope.patient.identifier).forEach(function (key) {
                    if ($scope.patient.identifier[key].value)
                        duplicateQuery[`identifier[${key}].value`] = $scope.patient.identifier[key].value;
                });
            if ($scope.patient.name)
                Object.keys($scope.patient.name).forEach(function (nameType) {

                    if (!Array.isArray($scope.patient.name[nameType]))
                        $scope.patient.name[nameType] = [$scope.patient.name[nameType]];

                    $scope.patient.name[nameType].forEach(function (name) {
                        if (name.component) {
                            Object.keys(name.component).forEach(function (componentType) {
                                if (nameType == "$other")
                                    duplicateQuery[`name.component[${componentType}].value`] = `~${name.component[componentType]}`; //`:(approx|"${name.component[componentType]}")`;
                                else
                                    duplicateQuery[`name[${nameType}].component[${componentType}].value`] = `:(approx|"${name.component[componentType]}")`;
                            });
                        }
                    });
                });

            // Set gender and age on duplicate query
            duplicateQuery["genderConcept"] = $scope.patient.genderConceptModel.id;
            //duplicateQuery["dateOfBirth"] = SanteDB.display.renderDate($scope.patient.dateOfBirth, $scope.patient.dateOfBirthPrecision);
            duplicateQuery["_offset"] = (page || 0) * 3;
            duplicateQuery["_count"] = 3;
            duplicateQuery["_upstream"] = true;
            // Check for duplicates 
            var duplicates = await SanteDB.resources.patient.findAsync(duplicateQuery);
            duplicates.pages = Math.round(duplicates.totalResults / 3);
            if(duplicates.pages * 3 < duplicates.totalResults)
                duplicates.pages++;
            duplicates.page = page;
            return duplicates;
        
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Correct information such as addresses and other information on the patient profile
    async function correctEntityInformation(entity) {
        // Update the address - Correcting any linked addresses to the strong addresses
        // TODO: 
        if (entity.address) {
            var addressList = [];
            var promises = Object.keys(entity.address).map(async function (k) {
                try {
                    var addr = entity.address[k];
                    if (!Array.isArray(addr))
                        addr = [addr];

                    var intlPromises = addr.map(async function (addrItem) {
                        addrItem.use = addrItem.useModel.id;
                        addrItem.component = addrItem.component || {};
                        delete (addrItem.useModel);
                        addressList.push(addrItem);
                    });
                    await Promise.all(intlPromises);
                }
                catch (e) {
                }
            });
            await Promise.all(promises);
            entity.address = { "$other": addressList };
        }
        if (entity.name) {
            var nameList = [];
            Object.keys(entity.name).forEach(function (k) {

                var name = entity.name[k];
                if (!Array.isArray(name))
                    name = [name];

                name.forEach(function (nameItem) {
                    nameItem.use = nameItem.useModel.id;
                    delete (nameItem.useModel);
                    nameList.push(nameItem);
                })

            });
            entity.name = { "$other": nameList };
        }

    }

    // Submit the form
    async function registerPatient(patientForm) {
        if (!patientForm.$valid) return;

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            if (!$scope.ignoreDuplicates)
            {
                var duplicates = await checkDuplicates();
                if(duplicates.totalResults > 0) {
                    $scope.duplicates = duplicates;
                    $("#duplicateModal").modal();
                    return ;
                }
            }

            // Submission object
            var patient = new Patient($scope.patient);
            patient.id = SanteDB.application.newGuid();
            await correctEntityInformation(patient);

            // Create a submission bundle with related entities
            var bundle = new Bundle({ resource: [ patient ]})
            if(patient.relationship) {
                var changedRels = Object.keys(patient.relationship).map(o=>patient.relationship[o]).flat();
                changedRels.filter(o=>o && o._active && o.targetModel).forEach(function(object) {
                    var entity = angular.copy(object.targetModel);
                    correctEntityInformation(entity);
                    object.holder = patient.id;
                    bundle.resource.push(entity);
                });

                patient.relationship.forEach(function(rel) {
                    rel.target
                    delete(rel.targetModel);
                })
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
            try {
                $scope.$apply();
            }
            catch(e2) {} // Ignore scope apply updates
        }
    }

    // Cancel submission
    function cancelEdit() {
        window.history.back();
    }

    // Confirm navigation away in AngularJS route
    $transitions.onStart({ exiting: "santedb-emr.patient.register" }, function (transition) {
        var form = angular.element("#editForm").scope().editForm;
        if (!form.$pristine) return confirm(SanteDB.locale.getString("ui.emr.navigateConfirmation"));
        return true;
    });

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        window.onbeforeunload = null;
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }
}]);
