"""
Configuration settings for different environments.
"""
import os

class Config:
    """Base config class"""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-please-change-in-production')
    
    # Static and template folders
    STATIC_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')
    TEMPLATE_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')
    
    # Data paths
    DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    GRAPH_DATA_PATH = os.path.join(STATIC_FOLDER, 'graph_data.json')
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # Syslog/remote logging configuration
    SYSLOG_ENABLED = os.environ.get('SYSLOG_ENABLED', 'False').lower() == 'true'
    # SYSLOG_ADDRESS can be:
    # - Unix socket path (e.g. '/dev/log')
    # - Network address tuple (e.g. 'logs.example.com:514')
    # - HTTPS endpoint (e.g. 'https://logs.mattburns.info/log')
    SYSLOG_ADDRESS = os.environ.get('SYSLOG_ADDRESS', 'https://logs.mattburns.info/logs')
    SYSLOG_FACILITY = os.environ.get('SYSLOG_FACILITY', 'local7')
    SYSLOG_FORMAT = os.environ.get('SYSLOG_FORMAT', '%(asctime)s %(levelname)s %(name)s: %(message)s')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    

class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = False
    TESTING = True
    

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Override default secret key to ensure it's set
    SECRET_KEY = os.environ.get('SECRET_KEY')
    
    # In production, enforce stricter CORS and CSP
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
    
    # Production might use different log level
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING')
    
    # Production syslog settings - enabled by default
    SYSLOG_ENABLED = os.environ.get('SYSLOG_ENABLED', 'True').lower() == 'true'


# Dictionary to easily retrieve the right config
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get the configuration based on environment"""
    env = os.environ.get('FLASK_ENV', 'default')
    return config.get(env, config['default'])