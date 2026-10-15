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

        stage('Check Branch') {
            steps {
                echo "Branch: ${env.BRANCH_NAME}"
                echo "Git branch: ${env.GIT_BRANCH}"
            }
        }

        stage('Write Environment File') {
            steps {
                withCredentials([
                    string(credentialsId: 'web-firebase-api-key',
                           variable: 'WEB_FIREBASE_API_KEY'),
                    string(credentialsId: 'web-firebase-auth-domain',
                           variable: 'WEB_FIREBASE_AUTH_DOMAIN'),
                    string(credentialsId: 'web-firebase-project-id',
                           variable: 'WEB_FIREBASE_PROJECT_ID'),
                    string(credentialsId: 'web-firebase-storage-bucket',
                           variable: 'WEB_FIREBASE_STORAGE_BUCKET'),
                    string(credentialsId: 'web-firebase-messaging-sender-id',
                           variable: 'WEB_FIREBASE_MESSAGING_SENDER_ID'),
                    string(credentialsId: 'web-firebase-app-id',
                           variable: 'WEB_FIREBASE_APP_ID')
                ]) {
                    sh '''
                        set +x
                        umask 077
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
                expression {
                    env.BRANCH_NAME == 'main' ||
                    env.GIT_BRANCH == 'origin/main' ||
                    env.GIT_BRANCH == 'main'
                }
            }

            steps {
                withCredentials([
                    string(
                        credentialsId: 'firebase-token',
                        variable: 'FIREBASE_TOKEN'
                    )
                ]) {
                    script {
                        docker.image(env.NODE_IMAGE).inside {
                            sh '''
                                npx firebase-tools deploy \
                                  --only hosting \
                                  --token "$FIREBASE_TOKEN" \
                                  --non-interactive
                            '''
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
            echo 'Pipeline failed. Check the failing stage in Console Output.'
        }

        always {
            sh(script: 'rm -f .env', returnStatus: true)
        }
    }
}
