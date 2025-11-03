using DocumentFormat.OpenXml.Wordprocessing;
using Hl7.Fhir.Utility;
using SanteDB;
using SanteDB.Client.Configuration;
using SanteDB.Core;
using SanteDB.Core.Configuration;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.DataTypes;
using SanteDB.Core.Model.Roles;
using SanteDB.Core.Security;
using SanteDB.Core.Security.Configuration;
using SanteEMR.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace SanteEMR.Configuration
{
    /// <summary>
    /// Initial configuration provider for configuring IMS initial services
    /// </summary>
    public class EmrInitialConfigurationProvider : IInitialConfigurationProvider
    {
        /// <inheritdoc/>
        public int Order => Int32.MaxValue;

        /// <inheritdoc/>
        public SanteDBConfiguration Provide(SanteDBHostType hostContextType, SanteDBConfiguration configuration)
        {
            if (hostContextType == SanteDBHostType.Client || hostContextType == SanteDBHostType.Gateway)
            {
                var appServiceSection = configuration.GetSection<ApplicationServiceContextConfigurationSection>();
                appServiceSection.ServiceProviders.Add(new TypeReferenceConfiguration(typeof(EmrInitializationDaemon))); // Register the EMR daemon service
            }

            // Get the configuration state for mapping policies
            if (configuration.GetSection<EmrConfigurationSection>() == null)
            {
                configuration.AddSection(new EmrConfigurationSection()
                {
                    AutoApplyPolicyMap = new List<EmrPolicyMappingConfiguration>()
                        {
                            new EmrPolicyMappingConfiguration()
                            {
                                ConceptSet = Guid.Parse("5bd5e5b7-6a4f-4362-b34a-52e07f396bf6"),
                                PolicyOid = DataPolicyIdentifiers.RestrictedInformation // Restricted Information
                            }
                        }
                });
            }

            // Set the default policy data for acts to mask if not already set
            var dpc = configuration.GetSection<DataPolicyFilterConfigurationSection>();
            if (dpc == null)
            {
                dpc = configuration.AddSection(new DataPolicyFilterConfigurationSection()
                {
                    DefaultAction = ResourceDataPolicyActionType.Hide,
                    Resources = new List<ResourceDataPolicyFilter>()
                        {
                            new ResourceDataPolicyFilter()
                            {
                                ResourceType = new ResourceTypeReferenceConfiguration(typeof(IdentityDomain)),
                                Action = ResourceDataPolicyActionType.Redact
                            }
                        }
                });
            }

            var dpcPatient = dpc.Resources.FirstOrDefault(o => o.ResourceType.Type == typeof(Patient));
            if (dpcPatient == null) {
                dpcPatient = new ResourceDataPolicyFilter()
                {
                    ResourceType = new ResourceTypeReferenceConfiguration(typeof(Patient))
                };
                dpc.Resources.Add(dpcPatient);
            }
            dpcPatient.Action = ResourceDataPolicyActionType.Redact;

            foreach (var at in AppDomain.CurrentDomain.GetAllTypes().Where(t => !t.IsAbstract && !t.IsInterface && typeof(Act).IsAssignableFrom(t)))
            {
                if (!dpc.Resources.Any(r => r.ResourceType.Type == at))
                {
                    dpc.Resources.Add(new ResourceDataPolicyFilter()
                    {
                        ResourceType = new ResourceTypeReferenceConfiguration(at),
                        Action = ResourceDataPolicyActionType.Redact
                    });
                }
            }

            return configuration;
        }
    }
}
