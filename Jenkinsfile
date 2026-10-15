pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        NODE_IMAGE = 'node:26-alpine3.23'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Write Environment File') {
            steps {
                withCredentials([
                    string(credentialsId: 'vite-firebase-api-key',             variable: 'WEB_FIREBASE_API_KEY'),
                    string(credentialsId: 'vite-firebase-auth-domain',         variable: 'WEB_FIREBASE_AUTH_DOMAIN'),
                    string(credentialsId: 'vite-firebase-project-id',          variable: 'WEB_FIREBASE_PROJECT_ID'),
                    string(credentialsId: 'vite-firebase-storage-bucket',      variable: 'WEB_FIREBASE_STORAGE_BUCKET'),
                    string(credentialsId: 'vite-firebase-messaging-sender-id', variable: 'WEB_FIREBASE_MESSAGING_SENDER_ID'),
                    string(credentialsId: 'vite-firebase-app-id',              variable: 'WEB_FIREBASE_APP_ID')
                ]) {
                    sh '''
                      cat > .env <<EOF
WEB_FIREBASE_API_KEY=$WEB_FIREBASE_API_KEY
WEB_FIREBASE_AUTH_DOMAIN=$WEB_FIREBASE_AUTH_DOMAIN
WEB_FIREBASE_PROJECT_ID=$WEB_FIREBASE_PROJECT_ID
WEB_FIREBASE_STORAGE_BUCKET=$WEB_FIREBASE_STORAGE_BUCKET
WEB_FIREBASE_MESSAGING_SENDER_ID=$WEB_FIREBASE_MESSAGING_SENDER_ID
WEB_FIREBASE_APP_ID=$WEB_FIREBASE_APP_ID
EOF
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    docker.image(env.NODE_IMAGE).inside {
                        sh 'npm install'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    docker.image(env.NODE_IMAGE).inside {
                        sh 'npm run build'
                    }
                }
            }
        }

        stage('Deploy to Firebase Hosting') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([string(credentialsId: 'firebase-token', variable: 'FIREBASE_TOKEN')]) {
                    script {
                        docker.image(env.NODE_IMAGE).inside {
                            sh 'npx firebase-tools deploy --only hosting --token "$FIREBASE_TOKEN" --non-interactive'
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Build and deploy finished successfully.'
        }
        failure {
            echo 'Pipeline failed — check the failing stage log above.'
        }
        always {
            sh(script: 'rm -f .env', returnStatus: true)
        }
    }
}