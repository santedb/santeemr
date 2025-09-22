using SanteDB.Client.Configuration;
using SanteDB.Core;
using SanteDB.Core.Configuration;
using SanteEMR.Services;
using System;
using System.Collections.Generic;
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
            return configuration;
        }
    }
}
