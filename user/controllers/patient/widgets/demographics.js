/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientViewWidgetController', ['$scope', '$rootScope', function ($scope, $rootScope) {


    $scope.showBarcode = function(barcodeDomain) {
        $scope.bcDomain = barcodeDomain;
        $("#barcodeModal").modal('show');
    }
    // Actually pull 
    $scope.update = async function (form) {

        // TODO: Update the address to the targetAddressId if it is present in the address.
        if (form.$invalid) {
            return false;
        }

        // Now post the changed update object 
        try {
            var submissionObject = angular.copy($scope.editObject);
            submissionObject.determinerConcept = DeterminerKeys.Specific;
            await correctEntityInformation(submissionObject);

            // Bundle to be submitted
            var bundle = new Bundle({ id:SanteDB.application.newGuid(),  resource: [submissionObject] });

            // Now have any of our relationships changed?
            if (submissionObject.relationship) {
                var changedRels = Object.keys(submissionObject.relationship).map(o => submissionObject.relationship[o].targetModel).flat();
                changedRels.filter(o => o && o.$edited).forEach(function (object) {
                    correctEntityInformation(object);
                    bundle.resource.push(object);
                })
            }

            await SanteDB.resources.bundle.updateAsync(bundle.id,  bundle);

            var pscope = $scope;
            while (pscope.$parent.scopedObject)
                pscope = pscope.$parent;
            pscope.scopedObject = await SanteDB.resources.patient.getAsync($scope.scopedObject.id, "full"); // re-fetch the patient
            pscope.editObject = angular.copy(pscope.scopedObject);
            toastr.success(SanteDB.locale.getString("ui.model.patient.saveSuccess"));
            form.$valid = true;

            try {
                pscope.$apply();
            }
            catch (e) { }
        }
        catch (e) {
            $rootScope.errorHandler(e);
            form.$valid = false;
        }
    };

    // Add identifier
    $scope.addIdentifier = function (id) {
        if (!$scope.panel.editForm.$valid) return;
        else {
            var authority = id.domainModel.domainName;
            var existing = $scope.editObject.identifier[authority];
            if (!existing) // no identifiers in this domain
                $scope.editObject.identifier[authority] = existing = [];
            else if (!Array.isArray(existing)) // Has only one => turn into array
                $scope.editObject.identifier[authority] = existing = [existing];
            id.id = SanteDB.application.newGuid();
            existing.push(angular.copy(id));
            delete (id.domainModel);
            delete (id.value);
            delete (id.id);
        }
    }

    // Remove identifier
    $scope.removeIdentifier = function (authority, id) {

        if (confirm(SanteDB.locale.getString("ui.model.entity.identifier.authority.remove.confirm"))) {
            var idList = $scope.editObject.identifier[authority];
            if (!Array.isArray(idList))
                idList = [idList];

            // Remove value from specified list
            idList = idList.filter(o => o.value != id);

            // Any items
            if (idList.length == 0)
                delete ($scope.editObject.identifier[authority]);
            else
                $scope.editObject.identifier[authority] = idList;
        }
    }

    // Watch will look for scoped object to load and will set necessary shortcut objects for the view 
    $scope.$watch("scopedObject", async function (n, o) {
        if (n && n != null) {

            delete ($scope.editObject); // Delete the current edit object
            $scope.editObject = angular.copy(n);

            // Correct identifiers to all be arrays
            if (n.identifier)
                Object.keys(n.identifier).forEach(function (key) {
                    if (!Array.isArray(n.identifier[key]))
                        n.identifier[key] = [n.identifier[key]];

                    n.identifier[key].forEach(function (id) {
                        id._codeUrl = `/hdsi/Patient/${n.id}/_code?_format=santedb-vrp`;
                    })
                });


            // Look up domicile
            if ($rootScope.system.config.application.setting['input.address'] == "select" && $scope.editObject.address) {
                var promises = Object.keys($scope.editObject.address).map(async function (prop) {
                    var addr = $scope.editObject.address[prop];
                    // query by census tract if possible
                    var query = {
                        _count: 2
                    };
                    if (addr.component && addr.component.CensusTract)
                        query["identifier.value"] = addr.component.CensusTract;
                    else {
                        // Query by full address
                        Object.keys(addr.component).forEach(function (prop) {
                            if (addr.component[prop] != "" && addr.component[prop] != "?")
                                query[`address.component[${prop}].value`] = addr.component[prop];
                        });
                    }

                    // Now query 
                    var results = await SanteDB.resources.place.findAsync(query);
                    if (results.total == 1 || results.resource.length == 1) {
                        addr.targetId = results.resource[0].id;
                    }
                });
                await Promise.all(promises);
            }
            else if (!$scope.editObject.address) {
                $scope.editObject.address = {
                    "HomeAddress": {
                        "useModel": {
                            "id": AddressUseKeys.HomeAddress,
                            "mnemonic": "HomeAddress"
                        }
                    }
                }
            }

        }
    });

    /**
     * Convert the specified person (reclass it) to a full patient
     */
    $scope.convertToPatient = async function (personToConvert) {

        if (!personToConvert.$converting)
            personToConvert.$converting = true;
        else if (confirm(SanteDB.locale.getString("ui.model.reclass.confirm"))) {
            try {
                var patient = new Patient(personToConvert);

                patient.tag = patient.tag || {};
                patient.classConcept = EntityClassKeys.Patient;
                delete (patient.classConceptModel);
                patient.tag["$sys.reclass"] = "true";

                var updatedPerson = await SanteDB.resources.patient.updateAsync(personToConvert.id, patient);
                personToConvert.$type = "Patient";
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }


}]);